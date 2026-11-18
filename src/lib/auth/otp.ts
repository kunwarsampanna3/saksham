import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config, policy } from "@/lib/config";
import { store } from "@/lib/store";
import type { OtpPurpose } from "@/lib/store/types";
import { codeEmail, emailConfigured, sendEmail } from "./email";

const pepper = () => config.sessionSecret;
const hashCode = (code: string, target: string) =>
  createHash("sha256").update(`${pepper()}:${target}:${code}`).digest("hex");

export type OtpSendResult =
  | { ok: true; devCode?: string; resendIn: number; channel: "sms" | "email" }
  | { ok: false; error: "otp_cooldown"; retryAfter: number }
  | { ok: false; error: "sms_unavailable" | "email_unavailable" };

/** A code target is a 10-digit Nepal mobile or a lower-case email address. */
export const isEmailTarget = (target: string) => target.includes("@");
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

export async function issueOtp(target: string, purpose: OtpPurpose): Promise<OtpSendResult> {
  const key = `${purpose}:${target}`;
  const existing = await store.getOtp(key);
  if (existing) {
    const since = (Date.now() - new Date(existing.lastSentAt).getTime()) / 1000;
    if (since < policy.otpResendSeconds) {
      return { ok: false, error: "otp_cooldown", retryAfter: Math.ceil(policy.otpResendSeconds - since) };
    }
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const email = isEmailTarget(target);

  let devCode: string | undefined;
  if (email) {
    // Email is free to send, so a configured mailbox is used even in DEMO_MODE (the code arrives for real).
    if (emailConfigured()) {
      const m = codeEmail(code, purpose);
      if (!(await sendEmail(target, m.subject, m.text, m.html))) return { ok: false, error: "email_unavailable" };
    } else if (config.demoMode) {
      devCode = code; // no mailbox configured: shown on screen, labelled "Sandbox · demo"
    } else {
      return { ok: false, error: "email_unavailable" };
    }
  } else {
    const text = `Saksham code: ${code}. Valid 5 minutes. Never share it — Saksham staff will never ask for it.`;
    if (config.demoMode) {
      devCode = code; // shown on screen, labelled "Sandbox OTP · demo"
    } else if (!(await sendSms(target, text))) {
      return { ok: false, error: "sms_unavailable" };
    }
  }

  await store.putOtp({
    key, phone: target, purpose,
    codeHash: hashCode(code, target),
    expiresAt: new Date(Date.now() + policy.otpTtlSeconds * 1000).toISOString(),
    attempts: 0,
    lastSentAt: new Date().toISOString(),
  });
  return { ok: true, devCode, resendIn: policy.otpResendSeconds, channel: email ? "email" : "sms" };
}

export type OtpCheck = { ok: true } | { ok: false; error: "otp_expired" | "otp_wrong" | "otp_too_many"; attemptsLeft?: number };

export async function checkOtp(target: string, purpose: OtpPurpose, code: string): Promise<OtpCheck> {
  const key = `${purpose}:${target}`;
  const rec = await store.getOtp(key);
  if (!rec || new Date(rec.expiresAt).getTime() < Date.now()) return { ok: false, error: "otp_expired" };
  if (rec.attempts >= policy.otpMaxAttempts) return { ok: false, error: "otp_too_many" };

  const a = Buffer.from(hashCode(code, target), "hex");
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

/* ---- "phone or email verified" ticket: proves OTP success to the next step (15 min, httpOnly) ---- */
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
