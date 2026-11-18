import { NextResponse, type NextRequest } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { fail, sameOrigin, clientIp } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/rate-limit";
import { rp, stashChallenge } from "@/lib/auth/passkey";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const rl = rateLimit(`passkey-opts:${clientIp(req)}`, 20, 60);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });

  // Discoverable credentials: the device offers whichever Saksham passkey it holds.
  const options = await generateAuthenticationOptions({ rpID: rp().rpID, userVerification: "required" });
  await stashChallenge(options.challenge, "login");
  return NextResponse.json({ ok: true, options });
}
