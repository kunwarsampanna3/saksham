import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

/**
 * WebAuthn (fingerprint / face / device PIN) helpers.
 * The challenge travels in a 5-minute signed httpOnly cookie, so no server state is needed.
 */
export const rp = () => {
  const origin = new URL(config.appOrigin);
  return { rpID: origin.hostname, rpName: "Saksham", origin: origin.origin };
};

const COOKIE = "sk_webauthn";
const key = () => new TextEncoder().encode(`${config.sessionSecret}:webauthn`);

export async function stashChallenge(challenge: string, kind: "register" | "login", userId?: string) {
  const jwt = await new SignJWT({ challenge, kind, uid: userId ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(key());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true, secure: config.isProd, sameSite: "strict", path: "/api/auth/passkey", maxAge: 300,
  });
}

export async function takeChallenge(kind: "register" | "login"): Promise<{ challenge: string; uid: string | null } | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  jar.set(COOKIE, "", { path: "/api/auth/passkey", maxAge: 0 });
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.kind !== kind || typeof payload.challenge !== "string") return null;
    return { challenge: payload.challenge, uid: typeof payload.uid === "string" ? payload.uid : null };
  } catch {
    return null;
  }
}

export const b64url = {
  encode: (u8: Uint8Array) => Buffer.from(u8).toString("base64url"),
  decode: (s: string) => new Uint8Array(Buffer.from(s, "base64url")),
};
