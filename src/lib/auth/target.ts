import "server-only";
import { z } from "zod";
import { emailSchema, phoneSchema } from "@/lib/validation";
import { store } from "@/lib/store";
import type { User } from "@/lib/store/types";

/**
 * Sign-in identifier: a Nepal mobile number OR an email address (exactly one).
 * Normalised to "98XXXXXXXX" or "name@example.com" so codes, rate limits and lookups all key on one string.
 */
export const targetFields = {
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
};

export const exactlyOne = (d: { phone?: string; email?: string }) => Boolean(d.phone) !== Boolean(d.email);
export const targetOf = (d: { phone?: string; email?: string }) => (d.email ?? d.phone)!;
export const isEmail = (target: string) => target.includes("@");

export function userByTarget(target: string): Promise<User | null> {
  return isEmail(target) ? store.getUserByEmail(target) : store.getUserByPhone(target);
}

export const takenError = (target: string) => (isEmail(target) ? "email_taken" : "phone_taken");

export const TargetOnly = z.object(targetFields).refine(exactlyOne, { message: "target_required" });
