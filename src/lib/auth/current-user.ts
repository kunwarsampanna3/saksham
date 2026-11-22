import "server-only";
import { redirect } from "next/navigation";
import { getAuth } from "./session";
import { config } from "@/lib/config";
import { toPublicUser } from "@/lib/store";
import type { PublicUser, User } from "@/lib/store/types";

/** Resolves the signed-in user from the session cookie, or null. */
export async function currentUser(): Promise<User | null> {
  const u = (await getAuth())?.user;
  if (!u) return null;
  // Owners listed in OWNER_PHONES are admins, without touching the database.
  return !u.isAdmin && config.ownerPhones.includes(u.phone) ? { ...u, isAdmin: true } : u;
}

export async function currentPublicUser(): Promise<PublicUser | null> {
  const u = await currentUser();
  return u ? toPublicUser(u) : null;
}

/** For server components/pages that need a signed-in user. */
export async function requireUser(next = "/"): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(`/login?next=${encodeURIComponent(next)}`);
  return u;
}
