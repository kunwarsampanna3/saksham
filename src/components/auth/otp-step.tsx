"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FlaskConical } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";

/**
 * Sends a code on mount, then verifies it. In DEMO_MODE the server returns the code and
 * we show it in a clearly labelled sandbox box — no real SMS is sent.
 */
export function OtpStep({
  target,
  purpose,
  onVerified,
  onChangeNumber,
}: {
  target: { phone: string } | { email: string };
  purpose: "signup" | "reset";
  onVerified: () => void;
  onChangeNumber: () => void;
}) {
  const viaEmail = "email" in target;
  const { t } = useI18n();
  const id = useId();
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const send = async () => {
    setError(null);
    const r = await postJson<{ devCode?: string; resendIn?: number; retryAfter?: number }>(
      "/api/auth/otp/request",
      { ...target, purpose },
    );
    if (r.ok) {
      setSent(true);
      setDevCode(r.devCode ?? null);
      setCooldown(r.resendIn ?? 30);
    } else if (r.error === "otp_cooldown" || r.error === "rate_limited") {
      setCooldown(r.retryAfter ?? 30);
      setSent(true);
      setError(t.otp.cooldown(r.retryAfter ?? 30));
    } else if (r.error === "phone_taken") {
      setError(t.signup.taken);
    } else if (r.error === "email_taken") {
      setError(t.signup.emailTaken);
    } else if (r.error === "signups_paused") {
      setError(t.market.blocked.signups);
    } else if (r.error === "sms_unavailable") {
      setError(t.otp.smsDown);
    } else if (r.error === "email_unavailable") {
      setError(t.otp.emailDown);
    } else {
      setError(r.error === "offline" ? t.errors.offline : t.errors.generic);
    }
  };

  // Send once on mount. (React runs effects twice in dev; a second request would only hit the 30 s cooldown.)
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send only once, on mount
  }, []);
  useEffect(() => {
    if (cooldown <= 0) return;
    const tm = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tm);
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const verify = async (c = code) => {
    if (!/^\d{6}$/.test(c)) {
      setError(t.errors.otp_format);
      return;
    }
    setBusy(true);
    setError(null);
    const r = await postJson<{ attemptsLeft?: number }>("/api/auth/otp/verify", {
      ...target,
      purpose,
      code: c,
    });
    setBusy(false);
    if (r.ok) return onVerified();
    if (r.error === "otp_wrong") setError(t.otp.wrong(r.attemptsLeft ?? 0));
    else if (r.error === "otp_expired") setError(t.otp.expired);
    else if (r.error === "otp_too_many") setError(t.otp.tooMany);
    else setError(r.error === "offline" ? t.errors.offline : t.errors.generic);
  };

  const pretty =
    "email" in target
      ? target.email
      : `+977 ${target.phone.slice(0, 3)} ${target.phone.slice(3, 6)} ${target.phone.slice(6)}`;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
      noValidate
    >
      <p className="text-muted">
        {sent ? (viaEmail && !devCode ? t.otp.sentToEmail(pretty) : t.otp.sentTo(pretty)) : t.common.loading}{" "}
        <button
          type="button"
          className="text-accent font-semibold underline-offset-4 hover:underline"
          onClick={onChangeNumber}
        >
          {viaEmail ? t.otp.changeEmail : t.otp.changeNumber}
        </button>
      </p>

      {devCode && (
        <div
          className="flex items-start gap-3 rounded-md border border-dashed border-[#c58a00] bg-[#fff8e6] p-3 text-[#4d3500] dark:bg-[#2c2208] dark:text-[#f6d27a]"
          role="status"
        >
          <FlaskConical size={20} aria-hidden className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              <span className="demo-tag mr-2">{t.common.sandbox}</span>
              {t.otp.sandboxCode}: <span className="font-display text-lg tracking-[0.2em]">{devCode}</span>
            </p>
            <p className="text-sm">{viaEmail ? t.otp.sandboxEmailNote : t.otp.sandboxNote}</p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor={id} className="field-label">
          {t.otp.code}
        </label>
        <input
          id={id}
          className="input font-display max-w-[16rem] text-center text-2xl tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          value={code}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            if (v.length === 6) void verify(v);
          }}
        />
        {error && (
          <p id={`${id}-err`} role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary min-w-40" disabled={busy || code.length !== 6}>
          {busy ? t.common.loading : t.otp.verify}
        </button>
        <button type="button" className="btn btn-quiet" disabled={cooldown > 0} onClick={() => void send()}>
          {cooldown > 0 ? t.otp.resendIn(cooldown) : t.otp.resend}
        </button>
      </div>
    </form>
  );
}
