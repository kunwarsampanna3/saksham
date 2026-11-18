import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { mpinSchema } from "@/lib/validation";
import { exactlyOne, targetFields, targetOf, userByTarget } from "@/lib/auth/target";
import { store, toPublicUser } from "@/lib/store";
import { burnTime, checkMpin, lockRemainingSeconds, lockUntilIso } from "@/lib/auth/mpin";
import { nowSec, setSessionCookie } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { policy } from "@/lib/config";

const Body = z.object({ ...targetFields, mpin: mpinSchema }).refine(exactlyOne, { message: "target_required" });

// Unknown numbers/emails get the same response shape as known ones (no account enumeration).
const ghostAttempts = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "login", schema: Body, limit: 12, windowSec: 60 });
  if ("res" in g) return g.res;
  const { mpin } = g.data;
  const phone = targetOf(g.data); // phone number or email

  const perPhone = rateLimit(`login-target:${phone}`, 15, 15 * 60);
  if (!perPhone.ok) return fail(429, "rate_limited", { retryAfter: perPhone.retryAfter });

  const user = await userByTarget(phone);
  if (!user) {
    await burnTime(mpin);
    const prev = ghostAttempts.get(phone);
    if (prev && prev.until > Date.now()) {
      return fail(423, "locked", { retryAfter: Math.ceil((prev.until - Date.now()) / 1000) });
    }
    const n = (prev && prev.until === 0 ? prev.n : 0) + 1;
    if (n >= policy.mpinMaxAttempts) {
      ghostAttempts.set(phone, { n: 0, until: Date.now() + policy.mpinLockMinutes * 60_000 });
      return fail(423, "locked", { retryAfter: policy.mpinLockMinutes * 60 });
    }
    ghostAttempts.set(phone, { n, until: 0 });
    return fail(401, "wrong_credentials", { attemptsLeft: policy.mpinMaxAttempts - n });
  }

  const locked = lockRemainingSeconds(user);
  if (locked > 0) return fail(423, "locked", { retryAfter: locked });

  if (!(await checkMpin(mpin, user.mpinHash))) {
    // A previous lock that has expired starts a fresh count.
    const attempts = (user.lockedUntil ? 0 : user.failedAttempts) + 1;
    if (attempts >= policy.mpinMaxAttempts) {
      await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: lockUntilIso() });
      return fail(423, "locked", { retryAfter: policy.mpinLockMinutes * 60 });
    }
    await store.updateUser(user.id, { failedAttempts: attempts, lockedUntil: null });
    return fail(401, "wrong_credentials", { attemptsLeft: policy.mpinMaxAttempts - attempts });
  }

  const fresh = await store.updateUser(user.id, { failedAttempts: 0, lockedUntil: null });
  await setSessionCookie({ sub: fresh.id, role: fresh.activeRole, mpinAt: nowSec() });
  return NextResponse.json({ ok: true, user: toPublicUser(fresh) });
}
