import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { mpinSchema } from "@/lib/validation";
import { tryMpin } from "@/lib/auth/mpin";
import { getSession, nowSec, setSessionCookie } from "@/lib/auth/session";

const Body = z.object({ mpin: mpinSchema });

/** Re-enter MPIN before a payment (required after 5 minutes idle). Shares the lockout counter with login. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "reauth", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const s = await getSession();
  if (!s) return fail(401, "signed_out");
  const r = await tryMpin(s.sub, g.data.mpin);
  if (!r.ok) {
    const { ok: _ok, error, ...extra } = r;
    return fail(error === "locked" ? 423 : 401, error, extra);
  }
  await setSessionCookie({ ...s, mpinAt: nowSec() });
  return NextResponse.json({ ok: true });
}
