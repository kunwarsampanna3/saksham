import "server-only";
import { notFound } from "next/navigation";
import type { User } from "@/lib/store/types";
import { isAdminAccount } from "@/lib/admin";
import { requireUser } from "@/lib/auth/current-user";

/**
 * Who may open /superadmin: the admin account (isAdmin, or a number in OWNER_PHONES). One role, full access.
 * Customers and applicants get 404, from pages and APIs alike, so the dashboard isn't revealed.
 */
export const isSuperAdmin = (u: User | null | undefined): u is User =>
  !!u && !u.suspended && isAdminAccount(u);

/** Every /superadmin page calls this itself: a layout alone doesn't run again when moving between its pages. */
export async function requireSuperAdmin(path = "/superadmin") {
  const user = await requireUser(path);
  if (!isSuperAdmin(user)) notFound();
  return user;
}
