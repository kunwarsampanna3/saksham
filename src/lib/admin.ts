import "server-only";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import type { Task, User } from "@/lib/store/types";
import { requireUser } from "@/lib/auth/current-user";
import { maskEmail, maskPhone } from "@/lib/validation";

/**
 * Who may see and do what on the dashboard.
 *  - An owner (a real admin account, or a number in OWNER_PHONES) sees and manages everyone.
 *  - The demo admin is one tap away for anyone who can open a demo site. With demo mode showing sign-in codes on
 *    screen, a visible phone number would be enough to take over a real account. So for real accounts the demo
 *    admin sees masked contacts and can't change them.
 *  - Nobody suspends or signs out an admin, themselves included.
 */
export const isAdminAccount = (u: User) => u.isAdmin || config.ownerPhones.includes(u.phone);

export const canSeePrivate = (admin: User, u: Pick<User, "isDemo">) => !admin.isDemo || u.isDemo;

export const canManage = (admin: User, u: User) =>
  admin.id !== u.id && !isAdminAccount(u) && canSeePrivate(admin, u);

/** A post belongs to its owner's side. Example posts have no owner and belong to the demo. */
export async function canManagePost(admin: User, post: Pick<Task, "clientId">) {
  if (!admin.isDemo || !post.clientId) return true;
  return !!(await store.getUserById(post.clientId))?.isDemo;
}

export function contactOf(admin: User, u: User) {
  return canSeePrivate(admin, u)
    ? { phone: u.phone, email: u.email ?? "", masked: false }
    : { phone: maskPhone(u.phone), email: u.email ? maskEmail(u.email) : "", masked: true };
}

/** Every admin page calls this itself: a layout alone doesn't run again when moving between its pages. */
export async function requireAdmin(path = "/admin") {
  const user = await requireUser(path);
  if (!user.isAdmin) notFound();
  return user;
}

export async function logAdmin(admin: User, action: string, target: string, detail = "") {
  await store.putAudit({
    id: randomUUID(),
    adminId: admin.id,
    adminName: admin.name,
    action,
    target,
    detail: detail.slice(0, 300),
    createdAt: new Date().toISOString(),
  });
}
