import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { phoneSchema } from "@/lib/validation";
import { store } from "@/lib/store";
import { issueOtp } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/auth/rate-limit";
import { policy } from "@/lib/config";

const Body = z.object({ phone: phoneSchema, purpose: z.enum(["signup", "reset"]) });

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "otp-request", schema: Body, limit: 6, windowSec: 60 });
  if ("res" in g) return g.res;
  const { phone, purpose } = g.data;

  // At most 5 codes per number per hour, whatever the IP.
  const perPhone = rateLimit(`otp-phone:${phone}`, 5, 3600);
  if (!perPhone.ok) return fail(429, "rate_limited", { retryAfter: perPhone.retryAfter });

  const existing = await store.getUserByPhone(phone);
  if (purpose === "signup" && existing) return fail(409, "phone_taken");
  if (purpose === "reset" && !existing) {
    // Same response as success so the endpoint can't be used to test which numbers have accounts.
    return NextResponse.json({ ok: true, resendIn: policy.otpResendSeconds });
  }

  const r = await issueOtp(phone, purpose);
  if (!r.ok) {
    if (r.error === "otp_cooldown") return fail(429, "otp_cooldown", { retryAfter: r.retryAfter });
    return fail(503, "sms_unavailable");
  }
  return NextResponse.json({ ok: true, resendIn: r.resendIn, devCode: r.devCode });
}
