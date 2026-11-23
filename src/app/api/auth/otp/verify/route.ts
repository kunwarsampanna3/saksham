import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { otpSchema } from "@/lib/validation";
import { exactlyOne, targetFields, targetOf, userByTarget } from "@/lib/auth/target";
import { checkOtp, setVerifiedTicket } from "@/lib/auth/otp";
import { config } from "@/lib/config";

const Body = z
  .object({ ...targetFields, purpose: z.enum(["signup", "reset"]), code: otpSchema })
  .refine(exactlyOne, { message: "target_required" });

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "otp-verify", schema: Body, limit: 15, windowSec: 60 });
  if ("res" in g) return g.res;
  if (config.publicDemo) return fail(403, "public_demo");
  const { purpose, code } = g.data;
  const target = targetOf(g.data);

  const r = await checkOtp(target, purpose, code);
  if (!r.ok) {
    const status = r.error === "otp_wrong" ? 401 : r.error === "otp_too_many" ? 429 : 410;
    return fail(status, r.error, { attemptsLeft: r.attemptsLeft });
  }
  const account = purpose === "reset" ? await userByTarget(target) : null;
  await setVerifiedTicket(target, purpose, account?.sessionVersion ?? 0);
  return NextResponse.json({ ok: true });
}
