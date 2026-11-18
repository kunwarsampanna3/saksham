import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { exactlyOne, takenError, targetFields, targetOf, userByTarget } from "@/lib/auth/target";
import { issueOtp } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/auth/rate-limit";
import { policy } from "@/lib/config";

const Body = z.object({ ...targetFields, purpose: z.enum(["signup", "reset"]) }).refine(exactlyOne, { message: "target_required" });

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "otp-request", schema: Body, limit: 6, windowSec: 60 });
  if ("res" in g) return g.res;
  const { purpose } = g.data;
  const target = targetOf(g.data);

  // At most 5 codes per number/email per hour, whatever the IP.
  const perPhone = rateLimit(`otp-target:${target}`, 5, 3600);
  if (!perPhone.ok) return fail(429, "rate_limited", { retryAfter: perPhone.retryAfter });

  const existing = await userByTarget(target);
  if (purpose === "signup" && existing) return fail(409, takenError(target));
  if (purpose === "reset" && !existing) {
    // Same response as success so the endpoint can't be used to test which numbers/emails have accounts.
    return NextResponse.json({ ok: true, resendIn: policy.otpResendSeconds });
  }

  const r = await issueOtp(target, purpose);
  if (!r.ok) {
    if (r.error === "otp_cooldown") return fail(429, "otp_cooldown", { retryAfter: r.retryAfter });
    return fail(503, r.error);
  }
  return NextResponse.json({ ok: true, resendIn: r.resendIn, devCode: r.devCode });
}
