import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config, policy } from "@/lib/config";
import { store } from "@/lib/store";
import type { OtpPurpose } from "@/lib/store/types";

const pepper = () => config.sessionSecret;
const hashCode = (code: string, phone: string) =>
  createHash("sha256").update(`${pepper()}:${phone}:${code}`).digest("hex");

export type OtpSendResult =
  | { ok: true; devCode?: string; resendIn: number }
  | { ok: false; error: "otp_cooldown"; retryAfter: number }
  | { ok: false; error: "sms_unavailable" };

/** Sends an SMS through the configured provider. Returns false if none is configured. */
async function sendSms(phone: string, text: string): Promise<boolean> {
  if (config.sms.provider === "sparrow" && config.sms.token) {
    // Sparrow SMS HTTP API (https://docs.sparrowsms.com). Kept minimal on purpose.
    const res = await fetch("https://api.sparrowsms.com/v2/sms/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: config.sms.token, from: config.sms.sender, to: phone, text }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  }
  return false;
}

export async function issueOtp(phone: string, purpose: OtpPurpose): Promise<OtpSendResult> {
  const key = `${purpose}:${phone}`;
  const existing = await store.getOtp(key);
  if (existing) {
    const since = (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
    if (since < policy.otpResendSeconds) {
      return { ok: false, error: "otp_cooldown", retryAfter: Math.ceil(policy.otpResendSeconds - since) };
    }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const text = `Saksham code: ${code}. Valid 5 minutes. Never share it — Saksham staff will never ask for it.`;

  let devCode: string | undefined;
  if (config.demoMode) {
    devCode = code; // shown on screen, labelled "Sandbox OTP · demo"
  } else if (!(await sendSms(phone, text))) {
    return { ok: false, error: "sms_unavailable" };
  }

  await store.putOtp({
    key, phone, purpose,
    codeHash: hashCode(code, phone),
    expiresAt: new Date(Date.now() + policy.otpTtlSeconds * 1000).toISOString(),
    attempts: 0,
    lastSentAt: new Date().toISOString(),
  });
  return { ok: true, devCode, resendIn: policy.otpResendSeconds };
}

export type OtpCheck = { ok: true } | { ok: false; error: "otp_expired" | "otp_wrong" | "otp_too_many"; attemptsLeft?: number };

export async function checkOtp(phone: string, purpose: OtpPurpose, code: string): Promise<OtpCheck> {
  const key = `${purpose}:${phone}`;
  const rec = await store.getOtp(key);
  if (!rec || new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false, error: "otp_expired" };
  if (rec.attempts >= policy.otpMaxAttempts) return { ok: false, error: "otp_too_many" };

  const a = Buffer.from(hashCode(code, phone), "hex");
  const b = Buffer.from(rec.codeHash, "hex");
  if (a.length === b.length && timingSafeEqual(a, b)) {
    await store.deleteOtp(key);
    return { ok: true };
  }
  const attempts = rec.attempts + 1;
  await store.putOtp({ ...rec, attempts });
  if (attempts >= policy.otpMaxAttempts) return { ok: false, error: "otp_too_many" };
  return { ok: false, error: "otp_wrong", attemptsLeft: policy.otpMaxAttempts - attempts };
}

/* ---- "phone verified" ticket: proves OTP success to the next step (15 min, httpOnly) ---- */
const TICKET = "sk_verified";
const ticketKey = () => new TextEncoder().encode(`${config.sessionSecret}:ticket`);

export async function setVerifiedTicket(phone: string, purpose: OtpPurpose) {
  const jwt = await new SignJWT({ purpose })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(phone)
    .setExpirationTime("15m")
    .sign(ticketKey());
  (await cookies()).set(TICKET, jwt, {
    httpOnly: true, secure: config.isProd, sameSite: "strict", path: "/api/auth", maxAge: 15 * 60,
  });
}

export async function readVerifiedTicket(purpose: OtpPurpose): Promise<string | null> {
  const token = (await cookies()).get(TICKET)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, ticketKey(), { algorithms: ["HS256"] });
    return payload.purpose === purpose && typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function clearVerifiedTicket() {
  (await cookies()).set(TICKET, "", { path: "/api/auth", maxAge: 0 });
}
