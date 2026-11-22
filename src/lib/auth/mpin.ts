import "server-only";
import bcrypt from "bcryptjs";
import { policy } from "@/lib/config";
import type { User } from "@/lib/store/types";
import { store } from "@/lib/store";
import { withLock } from "@/lib/lock";

const COST = 12;

export const hashMpin = (pin: string) => bcrypt.hash(pin, COST);
export const checkMpin = (pin: string, hash: string) => bcrypt.compare(pin, hash);

/** A fixed hash used to keep timing similar when the phone number is unknown. */
const DUMMY_HASH = bcrypt.hashSync("0000-not-a-real-pin", COST);
export const burnTime = (pin: string) => bcrypt.compare(pin, DUMMY_HASH);

export function lockRemainingSeconds(u: Pick<User, "lockedUntil">): number {
  if (!u.lockedUntil) return 0;
  return Math.max(0, Math.ceil((new Date(u.lockedUntil).getTime() - Date.now()) / 1000));
}

export type MpinResult =
  | { ok: true; user: User }
  | { ok: false; error: "signed_out" }
  | { ok: false; error: "locked"; retryAfter: number }
  | { ok: false; error: "wrong_credentials"; attemptsLeft: number };

/** One MPIN try, shared by login and re-auth. Tries on one account run one by one, so each one is counted. */
export function tryMpin(userId: string, pin: string): Promise<MpinResult> {
  return withLock<MpinResult>(`mpin:${userId}`, async () => {
    const user = await store.getUserById(userId);
    if (!user) return { ok: false, error: "signed_out" };
    const locked = lockRemainingSeconds(user);
    if (locked > 0) return { ok: false, error: "locked", retryAfter: locked };

    if (await checkMpin(pin, user.mpinHash))
      return { ok: true, user: await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: null }) };

    // A previous lock that has expired starts a fresh count.
    const attempts = (user.lockedUntil ? 0 : user.failedAttempts) + 1;
    if (attempts >= policy.mpinMaxAttempts) {
      await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: lockUntilIso() });
      return { ok: false, error: "locked", retryAfter: policy.mpinLockMinutes * 60 };
    }
    await store.updateUser(user.id, { failedAttempts: attempts, lockedUntil: null });
    return { ok: false, error: "wrong_credentials", attemptsLeft: policy.mpinMaxAttempts - attempts };
  });
}

export function lockUntilIso(): string {
  return new Date(Date.now() + policy.mpinLockMinutes * 60_000).toISOString();
}
