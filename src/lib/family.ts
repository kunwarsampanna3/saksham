import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { store } from "@/lib/store";
import type { Booking } from "@/lib/store/types";
import { notify, systemMessage } from "@/lib/chat";

/**
 * Hire-from-abroad family confirmation. The client creates a private link; only its SHA-256 hash is stored.
 * Whoever holds the link can confirm or flag delivered work — no account needed (family members may not use the app).
 * A confirmation is information for the client; only the client can release money.
 */
const hash = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createFamilyLink(b: Booking, familyName: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await store.putBooking({
    ...b,
    family: { name: familyName, tokenHash: hash(token), confirmations: b.family?.confirmations ?? [] },
    updatedAt: new Date().toISOString(),
  });
  return token;
}

export async function bookingForToken(token: string): Promise<Booking | null> {
  if (!/^[\w-]{20,64}$/.test(token)) return null;
  const h = hash(token);
  return (await store.listBookings()).find((b) => b.family?.tokenHash === h) ?? null;
}

export async function confirmWork(b: Booking, installmentId: string, ok: boolean, note: string) {
  const inst = b.installments.find((i) => i.id === installmentId);
  if (!inst || (inst.state !== "held" && inst.state !== "delivered")) return null;
  const at = new Date().toISOString();
  const confirmations = [
    ...(b.family?.confirmations ?? []).filter((c) => c.installmentId !== installmentId),
    { installmentId, ok, note, at },
  ];
  const nb = await store.putBooking({ ...b, family: { ...b.family!, confirmations }, updatedAt: at });
  const code = ok ? "family_confirmed" : "family_flagged";
  await notify(b.clientId, "payment", code, { name: b.family!.name }, `/payments/${b.id}`);
  await systemMessage(b.clientId, b.providerId, b.taskId, code, { name: b.family!.name });
  return nb;
}
