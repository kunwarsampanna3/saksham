import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { mpinSchema } from "@/lib/validation";
import { store } from "@/lib/store";
import { checkMpin, lockRemainingSeconds, lockUntilIso } from "@/lib/auth/mpin";
import { getSession, nowSec, setSessionCookie } from "@/lib/auth/session";
import { policy } from "@/lib/config";

const Body = z.object({ mpin: mpinSchema });

/** Re-enter MPIN before a payment (required after 5 minutes idle). Shares the lockout counter with login. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "reauth", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const s = await getSession();
  if (!s) return fail(401, "signed_out");
  const user = await store.getUserById(s.sub);
  if (!user) return fail(401, "signed_out");

  const locked = lockRemainingSeconds(user);
  if (locked > 0) return fail(423, "locked", { retryAfter: locked });

  if (!(await checkMpin(g.data.mpin, user.mpinHash))) {
    const attempts = (user.lockedUntil ? 0 : user.failedAttempts) + 1;
    if (attempts >= policy.mpinMaxAttempts) {
      await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: lockUntilIso() });
      return fail(423, "locked", { retryAfter: policy.mpinLockMinutes * 60 });
    }
    await store.updateUser(user.id, { failedAttempts: attempts, lockedUntil: null });
    return fail(401, "wrong_credentials", { attemptsLeft: policy.mpinMaxAttempts - attempts });
  }
  await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: null });
  await setSessionCookie({ ...s, mpinAt: nowSec() });
  return NextResponse.json({ ok: true });
}
