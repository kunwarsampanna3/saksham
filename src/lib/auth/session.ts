import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config, policy } from "@/lib/config";
import type { Role } from "@/lib/store/types";

export const SESSION_COOKIE = "sk_session";

export interface SessionClaims {
  sub: string; // user id
  role: Role; // active role at sign-in time (UI mode)
  /** epoch seconds of the last successful MPIN/passkey check — used for payment re-auth */
  mpinAt: number;
}

function key(): Uint8Array {
  const s = config.sessionSecret;
  if (s.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters. See .env.example.");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ role: claims.role, mpinAt: claims.mpinAt })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer("saksham")
    .setExpirationTime(`${policy.sessionDays}d`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "saksham", algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role === "provider" ? "provider" : "client",
      mpinAt: typeof payload.mpinAt === "number" ? payload.mpinAt : 0,
    };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax" as const,
  path: "/",
  maxAge: policy.sessionDays * 24 * 60 * 60,
};

export async function setSessionCookie(claims: SessionClaims) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(claims), cookieOptions);
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

export const nowSec = () => Math.floor(Date.now() / 1000);

/** True when the user must re-enter the MPIN before a payment action. */
export function needsPaymentReauth(s: SessionClaims): boolean {
  return nowSec() - s.mpinAt > policy.paymentReauthSeconds;
}
