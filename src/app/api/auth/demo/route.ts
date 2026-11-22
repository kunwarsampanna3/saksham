import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { config } from "@/lib/config";
import { store, toPublicUser } from "@/lib/store";
import { DEMO_PERSONAS, demoSeed } from "@/lib/auth/demo";
import { startSession } from "@/lib/auth/session";
import { ensureDemoVerifications } from "@/lib/verification";

const Body = z.object({ persona: z.enum(["mina", "bikash", "aasha", "suman"]) });

/** One-tap demo sign-in. Hard-disabled unless DEMO_MODE=true. */
export async function POST(req: NextRequest) {
  if (!config.demoMode) return fail(404, "not_found");
  const g = await guard(req, { name: "demo", schema: Body, limit: 30 });
  if ("res" in g) return g.res;

  const phone = DEMO_PERSONAS[g.data.persona].phone;
  let user = await store.getUserByPhone(phone);
  if (!user || !user.isDemo) {
    const seedAll = await demoSeed();
    const others = await store.getUserByPhone(DEMO_PERSONAS.mina.phone);
    // A persona added later (e.g. Suman) is created on its own, so the other demo accounts keep their progress.
    if (!user && others?.isDemo) user = await store.createUser(seedAll.find((x) => x.phone === phone)!);
    else {
      await store.resetDemo(seedAll);
      user = await store.getUserByPhone(phone);
    }
  }
  if (!user) return fail(500, "seed_failed");
  const seed = DEMO_PERSONAS[g.data.persona];
  const roles = [...seed.roles],
    categories = [...seed.categories];
  if (
    JSON.stringify(user.roles) !== JSON.stringify(roles) ||
    JSON.stringify(user.categories ?? []) !== JSON.stringify(categories) ||
    !roles.includes(user.activeRole)
  ) {
    user = await store.updateUser(user.id, {
      roles,
      categories,
      activeRole: roles.includes(user.activeRole) ? user.activeRole : seed.activeRole,
    });
  }
  await ensureDemoVerifications(user);
  user = (await store.getUserById(user.id)) ?? user;
  await startSession(user);
  return NextResponse.json({ ok: true, user: toPublicUser(user) });
}
