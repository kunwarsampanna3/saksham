import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import { withLock } from "@/lib/lock";
import { purgeExpired } from "@/lib/retention";
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

export type StatusMap = Record<
  VerificationKind,
  Pick<Verification, "status" | "simulated" | "fields" | "note" | "submittedAt" | "decidedAt"> & {
    fileIds: { id: string; label: string }[];
  }
>;

const empty = (): StatusMap[VerificationKind] => ({
  status: "not_started",
  simulated: false,
  fields: {},
  fileIds: [],
});

export async function statusFor(user: User): Promise<StatusMap> {
  await purgeExpired(user.id);
  const list = await store.listVerifications(user.id);
  const map = Object.fromEntries(KINDS.map((k) => [k, empty()])) as StatusMap;
  for (const v of list) {
    map[v.kind] = {
      status: v.status,
      simulated: v.simulated,
      fields: v.fields,
      note: v.note,
      submittedAt: v.submittedAt,
      decidedAt: v.decidedAt,
      fileIds: v.files.map((f) => ({ id: f.id, label: f.label })),
    };
  }
  // Phone accounts proved their number with an OTP at sign-up (demo accounts are pre-verified).
  // Email-only accounts proved their email instead, so the phone check stays open for them.
  if (map.phone.status === "not_started" && user.phone)
    map.phone = { ...empty(), status: "verified", simulated: user.isDemo };
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
  if (!kind || (kind[0] === "image/webp" && raw.toString("ascii", 8, 12) !== "WEBP"))
    throw new UploadError("file_type");
  try {
    const img = sharp(raw, { failOn: "error", limitInputPixels: 50_000_000 });
    const meta = await img.metadata();
    if (!meta.width || !meta.height || meta.width < 320 || meta.height < 240)
      throw new UploadError("file_small");
    // .rotate() applies EXIF orientation; sharp drops all metadata unless .withMetadata() is called.
    return await img
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    if (e instanceof UploadError) throw e;
    throw new UploadError("file_unreadable");
  }
}

export async function saveFiles(
  userId: string,
  kind: VerificationKind,
  items: { label: string; data: Buffer }[],
): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (const it of items) {
    const id = randomUUID();
    const path = `${userId}/${kind}/${id}.jpg`;
    await store.putFile(path, it.data, "image/jpeg");
    out.push({ id, path, mime: "image/jpeg", size: it.data.length, label: it.label });
  }
  return out;
}

/** The ID was replaced while a selfie was being compared with it. */
export class IdChangedError extends Error {}

interface Submission {
  files?: StoredFile[];
  fields?: Record<string, string>;
  status?: VerificationStatus;
  simulated?: boolean;
  note?: string;
  /** Selfie only: `submittedAt` of the ID the face was compared with. */
  matchedId?: string;
}

/**
 * Replace a verification (deleting any old documents first).
 * A selfie match belongs to one ID: a new ID deletes it, and a match against a replaced ID is refused.
 */
export function submit(user: User, kind: VerificationKind, data: Submission) {
  return withLock(`verify:${user.id}`, async () => {
    const list = await store.listVerifications(user.id);
    if (kind === "selfie") {
      const id = list.find((v) => v.kind === "id");
      if (!id || id.submittedAt !== data.matchedId) {
        for (const f of data.files ?? []) await store.deleteFile(f.path);
        throw new IdChangedError("id_changed");
      }
    }
    if (kind === "id") {
      const selfie = list.find((v) => v.kind === "selfie");
      for (const f of selfie?.files ?? []) await store.deleteFile(f.path);
      if (selfie) await store.deleteVerification(user.id, "selfie");
    }
    return replace(user, kind, data);
  });
}

async function replace(user: User, kind: VerificationKind, data: Submission) {
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
export function decide(...args: Parameters<typeof decideNow>) {
  return withLock(`verify:${args[0]}`, () => decideNow(...args));
}

async function decideNow(
  userId: string,
  kind: VerificationKind,
  decision: "verified" | "rejected",
  reviewerId: string | null,
  note?: string,
  /** When what the reviewer looked at was submitted. A newer upload must be looked at again. */
  seen?: string,
) {
  const v = (await store.listVerifications(userId)).find((x) => x.kind === kind);
  if (!v || v.status !== "pending" || (seen && v.submittedAt !== seen)) return null;
  const updated: Verification = {
    ...v,
    status: decision,
    decidedAt: new Date().toISOString(),
    purgeAfter: purgeDate(),
    reviewerId: reviewerId ?? undefined,
    simulated: reviewerId === null,
    note,
  };
  await store.putVerification(updated);
  await recomputeBadges(userId);
  return updated;
}

export function withdraw(user: User, kind: VerificationKind) {
  return withLock(`verify:${user.id}`, () => withdrawNow(user, kind));
}

async function withdrawNow(user: User, kind: VerificationKind) {
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

/** Demo personas start with sensible verification states (simulated, no documents). */
export async function ensureDemoVerifications(user: User) {
  if (!config.demoMode || !user.isDemo) return;
  if ((await store.listVerifications(user.id)).length) return;
  const plan: Partial<Record<VerificationKind, VerificationStatus>> =
    user.phone === "9800000002"
      ? { id: "verified", selfie: "verified" }
      : user.phone === "9800000003"
        ? { id: "verified", selfie: "verified", address: "verified", womenGroup: "verified" }
        : ["9800000001", "9800000004", "9800000005", "9800000006", "9800000007"].includes(user.phone)
          ? { id: "verified", selfie: "verified" }
          : {};
  for (const [kind, status] of Object.entries(plan) as [VerificationKind, VerificationStatus][]) {
    await store.putVerification({
      id: randomUUID(),
      userId: user.id,
      kind,
      status,
      simulated: true,
      files: [],
      fields: { source: "demo seed" },
      submittedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
    });
  }
  await recomputeBadges(user.id);
}
