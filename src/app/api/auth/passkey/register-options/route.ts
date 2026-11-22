import { NextResponse, type NextRequest } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { fail, sameOrigin } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { rp, stashChallenge } from "@/lib/auth/passkey";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const { rpID, rpName } = rp();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.phone || user.email || user.id,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: user.passkeys.map((p) => ({ id: p.id, transports: p.transports })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
      authenticatorAttachment: "platform",
    },
  });
  await stashChallenge(options.challenge, "register", user.id);
  return NextResponse.json({ ok: true, options });
}
