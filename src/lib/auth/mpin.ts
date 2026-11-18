import "server-only";
import bcrypt from "bcryptjs";
import { policy } from "@/lib/config";
import type { User } from "@/lib/store/types";

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

export function lockUntilIso(): string {
  return new Date(Date.now() + policy.mpinLockMinutes * 60_000).toISOString();
}
