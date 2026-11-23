import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { mpinSchema } from "@/lib/validation";
import { exactlyOne, targetFields, targetOf, userByTarget } from "@/lib/auth/target";
import { toPublicUser } from "@/lib/store";
import { burnTime, tryMpin } from "@/lib/auth/mpin";
import { startSession } from "@/lib/auth/session";
import { withLock } from "@/lib/lock";
import { rateLimit } from "@/lib/auth/rate-limit";
import { policy } from "@/lib/config";

const Body = z
  .object({ ...targetFields, mpin: mpinSchema })
  .refine(exactlyOne, { message: "target_required" });

// Unknown numbers/emails get the same response shape as known ones (no account enumeration).
const ghostAttempts = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "login", schema: Body, limit: 12, windowSec: 60, evenWhenPaused: true });
  if ("res" in g) return g.res;
  const { mpin } = g.data;
  const phone = targetOf(g.data); // phone number or email

  const perPhone = rateLimit(`login-target:${phone}`, 15, 15 * 60);
  if (!perPhone.ok) return fail(429, "rate_limited", { retryAfter: perPhone.retryAfter });

  const user = await userByTarget(phone);
  if (!user) {
    // Counted one by one like real accounts, so parallel guesses look the same too.
    return withLock(`mpin:ghost:${phone}`, async () => {
      const prev = ghostAttempts.get(phone);
      if (prev && prev.until > Date.now()) {
        return fail(423, "locked", { retryAfter: Math.ceil((prev.until - Date.now()) / 1000) });
      }
      await burnTime(mpin);
      const n = (prev && prev.until === 0 ? prev.n : 0) + 1;
      if (n >= policy.mpinMaxAttempts) {
        ghostAttempts.set(phone, { n: 0, until: Date.now() + policy.mpinLockMinutes * 60_000 });
        return fail(423, "locked", { retryAfter: policy.mpinLockMinutes * 60 });
      }
      ghostAttempts.set(phone, { n, until: 0 });
      return fail(401, "wrong_credentials", { attemptsLeft: policy.mpinMaxAttempts - n });
    });
  }

  const r = await tryMpin(user.id, mpin);
  if (!r.ok) {
    const { ok: _ok, error, ...extra } = r;
    return fail(error === "locked" ? 423 : 401, error, extra);
  }
  const fresh = r.user;
  // Only after the MPIN was right, so this says nothing about other people's accounts.
  if (fresh.suspended) return fail(403, "suspended");
  await startSession(fresh);
  return NextResponse.json({ ok: true, user: toPublicUser(fresh) });
}
