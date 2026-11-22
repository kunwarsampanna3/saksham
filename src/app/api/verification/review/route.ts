import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { decide, statusFor } from "@/lib/verification";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import { logAdmin } from "@/lib/admin";

const Body = z.object({
  userId: z.string().uuid().optional(),
  kind: z.enum(["id", "selfie", "address", "womenGroup"]),
  decision: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(300).optional(),
  submittedAt: z.string().max(40).optional(),
});

/**
 * Decide on a pending verification.
 *  - Admins: any other user (the /admin queue in step 9 uses this).
 *  - DEMO_MODE, demo accounts only: approve their OWN pending item as the "demo reviewer".
 *    Real accounts always wait for a real reviewer (an admin).
 *    That decision is stored as simulated and labelled so on screen.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "verify-review", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const me = await currentUser();
  if (!me) return fail(401, "signed_out");

  const targetId = g.data.userId ?? me.id;
  const own = targetId === me.id;
  if (own && !(config.demoMode && me.isDemo)) return fail(403, "no_self_review");
  if (!own && !me.isAdmin) return fail(403, "forbidden");

  const { kind, decision, note, submittedAt } = g.data;
  const v = await decide(targetId, kind, decision, own ? null : me.id, note, submittedAt);
  if (!v) return fail(409, "not_pending");
  const target = own ? me : await store.getUserById(targetId);
  if (!own) await logAdmin(me, decision, target?.name ?? targetId, kind);
  return NextResponse.json({ ok: true, status: target ? await statusFor(target) : null });
}
