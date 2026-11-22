import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";
import { withLock } from "@/lib/lock";
import { notify } from "@/lib/chat";
import { getControls } from "@/lib/controls";
import { cleanText } from "@/lib/task-api";
import { canManage, canManagePost, canSeePrivate, logAdmin } from "@/lib/admin";

const reason = z.string().trim().min(3, "reason").max(300, "reason");
const userId = z.string().uuid();

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend"), userId, reason }),
  z.object({ action: z.literal("unsuspend"), userId }),
  z.object({ action: z.literal("sign-out"), userId }),
  z.object({
    action: z.literal("take-down"),
    kind: z.enum(["task", "abroad"]),
    id: z.string().regex(/^[\w-]{3,64}$/),
    reason,
  }),
  z.object({
    action: z.literal("credit"),
    userId,
    id: z.string().uuid(),
    approve: z.boolean(),
  }),
  z.object({
    action: z.literal("controls"),
    signups: z.boolean(),
    posting: z.boolean(),
    applying: z.boolean(),
    maintenance: z.boolean(),
    maxOnline: z.number().int().min(0, "max_online").max(100_000, "max_online"),
  }),
]);

/** What the dashboard can change. Everyone who isn't an admin gets 404. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "admin-manage", schema: Body, limit: 60 });
  if ("res" in g) return g.res;
  const me = await currentUser();
  if (!me?.isAdmin) return fail(404, "not_found");
  const d = g.data;
  const at = new Date().toISOString();
  const done = () => NextResponse.json({ ok: true });

  switch (d.action) {
    case "suspend":
    case "unsuspend":
    case "sign-out":
      // The same lock as the MPIN reset, which also changes sessionVersion.
      return withLock(`mpin:${d.userId}`, async () => {
        const u = await store.getUserById(d.userId);
        if (!u) return fail(404, "not_found");
        if (!canManage(me, u)) return fail(403, "protected");
        const ended = { sessionVersion: (u.sessionVersion ?? 0) + 1, revokedSessions: [] };
        if (d.action === "suspend") {
          const why = cleanText(d.reason, 300);
          await store.updateUser(u.id, { ...ended, suspended: { at, by: me.id, reason: why } });
          await logAdmin(me, "suspend", u.name, why);
        } else if (d.action === "unsuspend") {
          await store.updateUser(u.id, { suspended: null });
          await logAdmin(me, "unsuspend", u.name);
        } else {
          await store.updateUser(u.id, ended);
          await logAdmin(me, "sign_out", u.name);
        }
        return done();
      });

    case "take-down":
      return withLock(`${d.kind}:${d.id}`, async () => {
        const why = cleanText(d.reason, 300);
        const removed = { at, by: me.id, reason: why };
        if (d.kind === "task") {
          const t = await store.getTask(d.id);
          if (!t || t.removed) return fail(404, "not_found");
          if (!(await canManagePost(me, t))) return fail(403, "protected");
          // Once money is in escrow the way out is a dispute, so nobody's payment is stranded.
          if (!["open", "expired", "assigned"].includes(t.status) || (await store.getBookingByTask(t.id)))
            return fail(409, "has_booking");
          for (const b of await store.listBids(t.id)) {
            if (b.status !== "active" && b.status !== "accepted") continue;
            await store.putBid({ ...b, status: "declined", updatedAt: at });
            if (!b.isExample) await notify(b.providerId, "bid", "post_gone", { task: t.title }, "/my-tasks");
          }
          await store.putTask({ ...t, status: "cancelled", removed, updatedAt: at });
          if (t.clientId) await notify(t.clientId, "system", "post_removed", { task: t.title }, "/my-tasks");
          await logAdmin(me, "take_down", t.title, why);
          return done();
        }
        const j = await store.getAbroadJob(d.id);
        if (!j || j.removed) return fail(404, "not_found");
        if (!(await canManagePost(me, j))) return fail(403, "protected");
        await store.putAbroadJob({ ...j, removed, updatedAt: at });
        const href = `/abroad/jobs/${j.id}`;
        await notify(j.clientId, "system", "post_removed", { task: j.title }, href);
        for (const a of j.applications)
          if (a.status === "pending") await notify(a.userId, "bid", "post_gone", { task: j.title }, href);
        await logAdmin(me, "take_down", j.title, why);
        return done();
      });

    case "credit":
      return withLock(`wallet:${d.userId}`, async () => {
        const u = await store.getUserById(d.userId);
        const a = (await store.listCreditApplications(d.userId)).find((x) => x.id === d.id);
        if (!u || !a) return fail(404, "not_found");
        if (u.id === me.id && !me.isDemo) return fail(403, "protected");
        if (!canSeePrivate(me, u)) return fail(403, "protected");
        if (a.status !== "submitted_demo") return fail(409, "decided");
        const status = d.approve ? "approved_demo" : "declined_demo";
        await store.putCreditApplication({ ...a, status, decidedAt: at, decidedBy: me.id });
        const code = d.approve ? "credit_approved" : "credit_declined";
        await notify(u.id, "system", code, { amount: a.amount }, "/wallet#credit");
        await logAdmin(me, code, u.name, String(a.amount));
        return done();
      });

    case "controls":
      return withLock("controls", async () => {
        const { action: _action, ...wanted } = d;
        const before = await getControls();
        const changed = (Object.keys(wanted) as (keyof typeof wanted)[]).filter(
          (k) => before[k] !== wanted[k],
        );
        if (!changed.length) return done();
        await store.putControls({ ...wanted, updatedAt: at, updatedBy: me.id });
        await logAdmin(me, "controls", "", changed.map((k) => `${k}=${wanted[k]}`).join(", "));
        return done();
      });
  }
}
