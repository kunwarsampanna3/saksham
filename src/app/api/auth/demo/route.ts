import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { config } from "@/lib/config";
import { store, toPublicUser } from "@/lib/store";
import { DEMO_PERSONAS, demoSeed, type DemoPersona } from "@/lib/auth/demo";
import { ensureAbroadDemo } from "@/lib/seed/abroad-demo";
import { withLock } from "@/lib/lock";
import { startSession } from "@/lib/auth/session";
import { ensureDemoVerifications } from "@/lib/verification";

const Body = z.object({
  persona: z.enum(Object.keys(DEMO_PERSONAS) as [DemoPersona, ...DemoPersona[]]),
});

/** One-tap demo sign-in. Hard-disabled unless DEMO_MODE=true. */
export async function POST(req: NextRequest) {
  if (!config.demoMode) return fail(404, "not_found");
  const g = await guard(req, { name: "demo", schema: Body, limit: 30, evenWhenPaused: true });
  if ("res" in g) return g.res;
  // One at a time: the first sign-in on an empty store creates every demo account, and two would collide.
  return withLock("demo:accounts", () => signIn(g.data.persona));
}

async function signIn(persona: DemoPersona) {
  const phone = DEMO_PERSONAS[persona].phone;
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
  if (user.suspended) return fail(403, "suspended");
  const seed = DEMO_PERSONAS[persona];
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
  await ensureAbroadDemo();
  await startSession(user);
  return NextResponse.json({ ok: true, user: toPublicUser(user) });
}
