import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { decide, statusFor } from "@/lib/verification";
import { config } from "@/lib/config";
import { store } from "@/lib/store";

const Body = z.object({
  userId: z.string().uuid().optional(),
  kind: z.enum(["id", "selfie", "address", "womenGroup"]),
  decision: z.enum(["verified", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

/**
 * Decide on a pending verification.
 *  - Admins: any other user (the /admin queue in step 9 uses this).
 *  - DEMO_MODE only: a user may approve their OWN pending item as the "demo reviewer".
 *    That decision is stored as simulated and labelled so on screen.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "verify-review", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const me = await currentUser();
  if (!me) return fail(401, "signed_out");

  const targetId = g.data.userId ?? me.id;
  const own = targetId === me.id;
  if (own && !config.demoMode) return fail(403, "no_self_review");
  if (!own && !me.isAdmin) return fail(403, "forbidden");

  const v = await decide(targetId, g.data.kind, g.data.decision, own ? null : me.id, g.data.note);
  if (!v) return fail(409, "not_pending");
  const target = own ? me : await store.getUserById(targetId);
  return NextResponse.json({ ok: true, status: target ? await statusFor(target) : null });
}
