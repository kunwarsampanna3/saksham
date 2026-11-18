import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import type { StoredFile, User, Verification, VerificationKind, VerificationStatus } from "@/lib/store/types";

/**
 * Verification rules (plain code):
 *  - phone: verified by OTP at sign-up.
 *  - id: citizenship / national ID / student ID photos → reviewed by a person.
 *  - selfie: compared to the ID photo. No face-match provider is connected, so in DEMO_MODE the
 *    match is SIMULATED (labelled on screen); otherwise it waits for manual review.
 *  - address: ward + tole, reviewed.
 *  - womenGroup: proof that a group is women-led, reviewed (providers only).
 * The Verified stamp = phone + id + selfie verified. Women-led badge = womenGroup verified.
 * Documents are stored privately, re-encoded without metadata, and deleted 90 days after a decision.
 */
export const KINDS: VerificationKind[] = ["phone", "id", "selfie", "address", "womenGroup"];
export const RETENTION_DAYS = 90;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export type StatusMap = Record<VerificationKind, Pick<Verification, "status" | "simulated" | "fields" | "note" | "submittedAt" | "decidedAt"> & { fileIds: { id: string; label: string }[] }>;

const empty = (): StatusMap[VerificationKind] => ({ status: "not_started", simulated: false, fields: {}, fileIds: [] });

export async function statusFor(user: User): Promise<StatusMap> {
  await purgeExpired(user.id);
  const list = await store.listVerifications(user.id);
  const map = Object.fromEntries(KINDS.map((k) => [k, empty()])) as StatusMap;
  for (const v of list) {
    map[v.kind] = {
      status: v.status, simulated: v.simulated, fields: v.fields, note: v.note, submittedAt: v.submittedAt, decidedAt: v.decidedAt,
      fileIds: v.files.map((f) => ({ id: f.id, label: f.label })),
    };
  }
  // Phone accounts proved their number with an OTP at sign-up (demo accounts are pre-verified).
  // Email-only accounts proved their email instead, so the phone check stays open for them.
  if (map.phone.status === "not_started" && user.phone) map.phone = { ...empty(), status: "verified", simulated: user.isDemo };
  return map;
}

/* ------------------------------------------------------------------ images */
const MAGIC: [string, number[]][] = [
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/webp", [0x52, 0x49, 0x46, 0x46]], // RIFF…WEBP (checked below)
];

export class UploadError extends Error {}

/** Validates an uploaded image by content (not by name or declared type), strips all metadata (GPS!) and re-encodes as JPEG. */
export async function cleanImage(file: File): Promise<Buffer> {
  if (!(file instanceof File) || file.size === 0) throw new UploadError("file_missing");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("file_too_big");
  const raw = Buffer.from(await file.arrayBuffer());
  const kind = MAGIC.find(([, sig]) => sig.every((b, i) => raw[i] === b));
  if (!kind || (kind[0] === "image/webp" && raw.toString("ascii", 8, 12) !== "WEBP")) throw new UploadError("file_type");
  try {
    const img = sharp(raw, { failOn: "error", limitInputPixels: 50_000_000 });
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 320 || meta.height < 240) throw new UploadError("file_small");
    // .rotate() applies EXIF orientation; sharp drops all metadata unless .withMetadata() is called.
    return await img.rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  } catch (e) {
    if (e instanceof UploadError) throw e;
    throw new UploadError("file_unreadable");
  }
}

export async function saveFiles(userId: string, kind: VerificationKind, items: { label: string; data: Buffer }[]): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (const it of items) {
    const id = randomUUID();
    const path = `${userId}/${kind}/${id}.jpg`;
    await store.putFile(path, it.data, "image/jpeg");
    out.push({ id, path, mime: "image/jpeg", size: it.data.length, label: it.label });
  }
  return out;
}

/** Replace a verification (deleting any old documents first). */
export async function submit(user: User, kind: VerificationKind, data: { files?: StoredFile[]; fields?: Record<string, string>; status?: VerificationStatus; simulated?: boolean; note?: string }) {
  const prev = (await store.listVerifications(user.id)).find((v) => v.kind === kind);
  for (const f of prev?.files ?? []) await store.deleteFile(f.path);
  const now = new Date().toISOString();
  const status = data.status ?? "pending";
  const v: Verification = {
    id: prev?.id ?? randomUUID(),
    userId: user.id,
    kind,
    status,
    simulated: data.simulated ?? false,
    files: data.files ?? [],
    fields: data.fields ?? {},
    note: data.note,
    submittedAt: now,
    ...(status === "verified" || status === "rejected" ? { decidedAt: now, purgeAfter: purgeDate() } : {}),
  };
  await store.putVerification(v);
  await recomputeBadges(user.id);
  return v;
}

const purgeDate = () => new Date(Date.now() + RETENTION_DAYS * 86_400_000).toISOString();

/** A reviewer (or, in DEMO_MODE only, the simulated demo reviewer) decides on a pending item. */
export async function decide(userId: string, kind: VerificationKind, decision: "verified" | "rejected", reviewerId: string | null, note?: string) {
  const v = (await store.listVerifications(userId)).find((x) => x.kind === kind);
  if (!v || v.status !== "pending") return null;
  const updated: Verification = {
    ...v, status: decision, decidedAt: new Date().toISOString(), purgeAfter: purgeDate(),
    reviewerId: reviewerId ?? undefined, simulated: reviewerId === null, note,
  };
  await store.putVerification(updated);
  await recomputeBadges(userId);
  return updated;
}

export async function withdraw(user: User, kind: VerificationKind) {
  const v = (await store.listVerifications(user.id)).find((x) => x.kind === kind);
  for (const f of v?.files ?? []) await store.deleteFile(f.path);
  await store.deleteVerification(user.id, kind);
  // Removing the ID also invalidates a selfie match made against it.
  if (kind === "id") {
    const s = (await store.listVerifications(user.id)).find((x) => x.kind === "selfie");
    for (const f of s?.files ?? []) await store.deleteFile(f.path);
    if (s) await store.deleteVerification(user.id, "selfie");
  }
  await recomputeBadges(user.id);
}

/** Keep the denormalised badges on the user in step with decisions. */
export async function recomputeBadges(userId: string) {
  const list = await store.listVerifications(userId);
  const ok = (k: VerificationKind) => list.some((v) => v.kind === k && v.status === "verified");
  await store.updateUser(userId, { verified: ok("id") && ok("selfie"), womenLed: ok("womenGroup") });
}

/** Delete document files whose retention period has passed (decision kept, images gone). */
async function purgeExpired(userId: string) {
  const now = Date.now();
  for (const v of await store.listVerifications(userId)) {
    if (v.purgeAfter && new Date(v.purgeAfter).getTime() < now && v.files.length) {
      for (const f of v.files) await store.deleteFile(f.path);
      await store.putVerification({ ...v, files: [] });
    }
  }
}

/** Demo personas start with sensible verification states (simulated, no documents). */
export async function ensureDemoVerifications(user: User) {
  if (!config.demoMode || !user.isDemo) return;
  if ((await store.listVerifications(user.id)).length) return;
  const plan: Partial<Record<VerificationKind, VerificationStatus>> =
    user.phone === "9800000002" ? { id: "verified", selfie: "verified" }
    : user.phone === "9800000003" ? { id: "verified", selfie: "verified", address: "verified", womenGroup: "verified" }
    : {};
  for (const [kind, status] of Object.entries(plan) as [VerificationKind, VerificationStatus][]) {
    await store.putVerification({
      id: randomUUID(), userId: user.id, kind, status, simulated: true, files: [], fields: { source: "demo seed" },
      submittedAt: new Date().toISOString(), decidedAt: new Date().toISOString(),
    });
  }
  await recomputeBadges(user.id);
}
