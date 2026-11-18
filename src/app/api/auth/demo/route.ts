import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { config } from "@/lib/config";
import { store, toPublicUser } from "@/lib/store";
import { DEMO_PERSONAS, demoSeed } from "@/lib/auth/demo";
import { nowSec, setSessionCookie } from "@/lib/auth/session";
import { ensureDemoVerifications } from "@/lib/verification";

const Body = z.object({ persona: z.enum(["mina", "bikash", "aasha"]) });

/** One-tap demo sign-in. Hard-disabled unless DEMO_MODE=true. */
export async function POST(req: NextRequest) {
  if (!config.demoMode) return fail(404, "not_found");
  const g = await guard(req, { name: "demo", schema: Body, limit: 30 });
  if ("res" in g) return g.res;

  const phone = DEMO_PERSONAS[g.data.persona].phone;
  let user = await store.getUserByPhone(phone);
  if (!user || !user.isDemo) {
    await store.resetDemo(await demoSeed());
    user = await store.getUserByPhone(phone);
  }
  if (!user) return fail(500, "seed_failed");
  await ensureDemoVerifications(user);
  user = (await store.getUserById(user.id)) ?? user;
  await setSessionCookie({ sub: user.id, role: user.activeRole, mpinAt: nowSec() });
  return NextResponse.json({ ok: true, user: toPublicUser(user) });
}
