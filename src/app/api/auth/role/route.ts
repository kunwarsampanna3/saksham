import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { store, toPublicUser } from "@/lib/store";
import { getSession, setSessionCookie } from "@/lib/auth/session";

const Body = z.object({ role: z.enum(["client", "provider"]), enable: z.boolean().optional() });

/** Switch between Client and Provider mode. `enable` adds the role to an account that lacks it. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "role", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const s = await getSession();
  if (!s) return fail(401, "signed_out");
  const user = await store.getUserById(s.sub);
  if (!user) return fail(401, "signed_out");

  const { role, enable } = g.data;
  let roles = user.roles;
  if (!roles.includes(role)) {
    if (!enable) return fail(403, "role_not_enabled");
    roles = [...roles, role];
  }
  const updated = await store.updateUser(user.id, { roles, activeRole: role });
  await setSessionCookie({ ...s, role });
  return NextResponse.json({ ok: true, user: toPublicUser(updated) });
}
