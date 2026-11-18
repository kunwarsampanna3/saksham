import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { otpSchema, phoneSchema } from "@/lib/validation";
import { checkOtp, setVerifiedTicket } from "@/lib/auth/otp";

const Body = z.object({ phone: phoneSchema, purpose: z.enum(["signup", "reset"]), code: otpSchema });

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "otp-verify", schema: Body, limit: 15, windowSec: 60 });
  if ("res" in g) return g.res;
  const { phone, purpose, code } = g.data;

  const r = await checkOtp(phone, purpose, code);
  if (!r.ok) {
    const status = r.error === "otp_wrong" ? 401 : r.error === "otp_too_many" ? 429 : 410;
    return fail(status, r.error, { attemptsLeft: r.attemptsLeft });
  }
  await setVerifiedTicket(phone, purpose);
  return NextResponse.json({ ok: true });
}
