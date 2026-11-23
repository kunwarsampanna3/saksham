import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { fail, sameOrigin } from "@/lib/auth/http";
import { b64url, rp, takeChallenge } from "@/lib/auth/passkey";
import { store, toPublicUser } from "@/lib/store";
import { lockRemainingSeconds } from "@/lib/auth/mpin";
import { startSession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  const stash = await takeChallenge("login");
  if (!stash) return fail(400, "challenge_expired");

  let body: { response: AuthenticationResponseJSON };
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_json");
  }
  const user = await store.getUserByPasskeyId(body.response?.id ?? "");
  if (!user) return fail(401, "passkey_unknown");
  if (lockRemainingSeconds(user) > 0) return fail(423, "locked", { retryAfter: lockRemainingSeconds(user) });
  const pk = user.passkeys.find((p) => p.id === body.response.id)!;

  const { rpID, origin } = rp();
  try {
    const v = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: stash.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: pk.id,
        publicKey: b64url.decode(pk.publicKey),
        counter: pk.counter,
        transports: pk.transports,
      },
    });
    if (!v.verified) return fail(401, "passkey_failed");
    await store.updateUser(user.id, {
      passkeys: user.passkeys.map((p) =>
        p.id === pk.id ? { ...p, counter: v.authenticationInfo.newCounter } : p,
      ),
    });
    if (user.suspended) return fail(403, "suspended");
    await startSession(user);
    return NextResponse.json({ ok: true, user: toPublicUser(user) });
  } catch {
    return fail(401, "passkey_failed");
  }
}
