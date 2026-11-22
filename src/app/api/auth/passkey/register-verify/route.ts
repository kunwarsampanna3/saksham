import { NextResponse, type NextRequest } from "next/server";
import { verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { fail, sameOrigin } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { b64url, rp, takeChallenge } from "@/lib/auth/passkey";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const stash = await takeChallenge("register");
  if (!stash || stash.uid !== user.id) return fail(400, "challenge_expired");

  let body: { response: RegistrationResponseJSON; label?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_json");
  }
  const { rpID, origin } = rp();
  try {
    const v = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: stash.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
    if (!v.verified) return fail(400, "passkey_failed");
    const c = v.registrationInfo.credential;
    const label = String(body.label ?? "This device").slice(0, 40);
    await store.updateUser(user.id, {
      passkeys: [
        ...user.passkeys.filter((p) => p.id !== c.id),
        {
          id: c.id,
          publicKey: b64url.encode(c.publicKey),
          counter: c.counter,
          transports: c.transports,
          label,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    return NextResponse.json({ ok: true });
  } catch {
    return fail(400, "passkey_failed");
  }
}
