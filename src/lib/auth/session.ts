import "server-only";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config, policy } from "@/lib/config";
import type { Role, User } from "@/lib/store/types";
import { store } from "@/lib/store";
import { withLock } from "@/lib/lock";

export const SESSION_COOKIE = "sk_session";

export interface SessionClaims {
  sub: string; // user id
  role: Role; // active role at sign-in time (UI mode)
  /** This sign-in. Kept when the cookie is re-signed, so signing out ends all its copies. */
  sid: string;
  /** The account's sessionVersion at sign-in. An older one no longer works. */
  ver: number;
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
  return new SignJWT({ role: claims.role, mpinAt: claims.mpinAt, sid: claims.sid, ver: claims.ver })
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
      // Cookies from before sessions had an id are named by the second they were issued.
      sid: typeof payload.sid === "string" ? payload.sid : `iat:${payload.iat}`,
      ver: typeof payload.ver === "number" ? payload.ver : 0,
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

/**
 * The session and its account, or null. A valid signature is not enough: the session must not have been
 * signed out, or ended by an MPIN reset. (Middleware only checks the signature; pages and APIs check this.)
 */
export async function getAuth(): Promise<{ session: SessionClaims; user: User } | null> {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await store.getUserById(session.sub);
  if (!user || user.suspended || (user.sessionVersion ?? 0) !== session.ver) return null;
  if (user.revokedSessions?.some((r) => r.sid === session.sid)) return null;
  return { session, user };
}

export async function getSession(): Promise<SessionClaims | null> {
  return (await getAuth())?.session ?? null;
}

/** A new sign-in, after the MPIN, code or passkey was checked. */
export async function startSession(user: User) {
  await setSessionCookie({
    sub: user.id,
    role: user.activeRole,
    mpinAt: nowSec(),
    sid: randomUUID(),
    ver: user.sessionVersion ?? 0,
  });
}

/** Sign out: this session stops working everywhere. Other devices stay signed in. */
export async function endSession() {
  const s = await getSession();
  if (s)
    await withLock(`sessions:${s.sub}`, async () => {
      const user = await store.getUserById(s.sub);
      if (!user) return;
      const now = Date.now();
      // Re-signing can extend a token up to the moment of sign-out, and never after it.
      const until = new Date(now + policy.sessionDays * 86_400_000).toISOString();
      const live = (user.revokedSessions ?? []).filter((r) => new Date(r.until).getTime() > now);
      await store.updateUser(user.id, { revokedSessions: [...live, { sid: s.sid, until }] });
    });
  await clearSessionCookie();
}

export const nowSec = () => Math.floor(Date.now() / 1000);

/** True when the user must re-enter the MPIN before a payment action. */
export function needsPaymentReauth(s: SessionClaims): boolean {
  return nowSec() - s.mpinAt > policy.paymentReauthSeconds;
}
