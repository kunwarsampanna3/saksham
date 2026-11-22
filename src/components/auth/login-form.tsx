"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, LockKeyhole, ArrowRight } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { postJson, useI18n, useUser } from "@/components/providers";
import { MpinInput, type MpinHandle } from "./mpin-input";
import { AuthSwitch } from "./auth-switch";
import { isNepalMobile } from "./phone-input";
import { IdentityInput, isEmailAddress, targetBody, type Channel } from "./identity-input";
import { safeNext } from "@/lib/safe-next";
import type { PublicUser } from "@/lib/store/types";

export const PASSKEY_FLAG = "sk_passkey_device";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const { setUser } = useUser();
  const router = useRouter();
  const pinRef = useRef<MpinHandle>(null);

  const [channel, setChannel] = useState<Channel>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mpin, setMpin] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);
  const [canBiometric, setCanBiometric] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem("sk_last_phone");
      if (last && isNepalMobile(last)) setPhone(last);
      const lastEmail = localStorage.getItem("sk_last_email");
      if (lastEmail && isEmailAddress(lastEmail)) setEmail(lastEmail);
      if (localStorage.getItem("sk_last_channel") === "email") setChannel("email");
    } catch {
      /* storage unavailable */
    }
    (async () => {
      try {
        const flagged = localStorage.getItem(PASSKEY_FLAG) === "1";
        const ok =
          typeof window.PublicKeyCredential !== "undefined" &&
          (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
        setCanBiometric(ok && flagged);
      } catch {
        setCanBiometric(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const tm = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tm);
  }, [lockedFor > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (user: PublicUser) => {
    try {
      if (channel === "email") localStorage.setItem("sk_last_email", email.trim().toLowerCase());
      else localStorage.setItem("sk_last_phone", phone);
      localStorage.setItem("sk_last_channel", channel);
    } catch {
      /* ignore */
    }
    setUser(user);
    router.replace(safeNext(next));
    router.refresh();
  };

  const fail = (msg: string) => {
    setPinErr(msg);
    setShakeKey((k) => k + 1);
    setMpin("");
    setTimeout(() => pinRef.current?.focus(), 30);
  };

  const submit = async (pin = mpin) => {
    setPhoneErr(null);
    setPinErr(null);
    if (channel === "phone" && !isNepalMobile(phone)) {
      setPhoneErr(t.errors.phone_invalid);
      return;
    }
    if (channel === "email" && !isEmailAddress(email)) {
      setPhoneErr(t.errors.email_invalid);
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      fail(t.errors.mpin_format);
      return;
    }
    if (lockedFor > 0) return;
    setBusy(true);
    const r = await postJson<{ user: PublicUser; attemptsLeft?: number; retryAfter?: number }>(
      "/api/auth/login",
      { ...targetBody(channel, phone, email), mpin: pin },
    );
    setBusy(false);
    if (r.ok) return done(r.user);
    if (r.error === "wrong_credentials")
      fail(`${t.login.wrong} ${t.login.attemptsLeft(r.attemptsLeft ?? 0)}`);
    else if (r.error === "locked") {
      setLockedFor(r.retryAfter ?? 900);
      fail(t.login.locked(Math.ceil((r.retryAfter ?? 900) / 60)));
    } else if (r.error === "rate_limited") fail(t.login.rateLimited);
    else if (r.error === "suspended") fail(t.market.blocked.suspended);
    else if (r.error === "phone_invalid") setPhoneErr(t.errors.phone_invalid);
    else if (r.error === "email_invalid") setPhoneErr(t.errors.email_invalid);
    else fail(r.error === "offline" ? t.errors.offline : t.errors.generic);
  };

  const biometric = async () => {
    setPinErr(null);
    const o = await postJson<{ options: Parameters<typeof startAuthentication>[0]["optionsJSON"] }>(
      "/api/auth/passkey/login-options",
      {},
    );
    if (!o.ok) return fail(t.errors.generic);
    try {
      const response = await startAuthentication({ optionsJSON: o.options });
      const r = await postJson<{ user: PublicUser; retryAfter?: number }>("/api/auth/passkey/login-verify", {
        response,
      });
      if (r.ok) return done(r.user);
      if (r.error === "locked") return fail(t.login.locked(Math.ceil((r.retryAfter ?? 900) / 60)));
      if (r.error === "suspended") return fail(t.market.blocked.suspended);
      if (r.error === "passkey_unknown") {
        try {
          localStorage.removeItem(PASSKEY_FLAG);
        } catch {}
        setCanBiometric(false);
      }
      fail(t.errors.generic);
    } catch {
      /* user cancelled the system prompt — nothing to show */
    }
  };

  const lockedMin = Math.ceil(lockedFor / 60);

  return (
    <div>
      <AuthSwitch active="login" />
      <p className="text-accent font-semibold" lang="ne">
        नमस्ते
      </p>
      <h1 className="font-display mt-1 text-[2.1rem] font-extrabold sm:text-[2.5rem]">{t.login.title}</h1>
      <p className="text-muted mt-1.5">{t.login.subtitle}</p>

      <form
        className="mt-7 space-y-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <IdentityInput
          channel={channel}
          onChannel={(c) => {
            setChannel(c);
            setPhoneErr(null);
          }}
          phone={phone}
          onPhone={(v) => {
            setPhone(v);
            setPhoneErr(null);
          }}
          email={email}
          onEmail={(v) => {
            setEmail(v);
            setPhoneErr(null);
          }}
          error={phoneErr}
          autoFocus={channel === "phone" ? !phone : !email}
        />
        <MpinInput
          ref={pinRef}
          value={mpin}
          onChange={(v) => {
            setMpin(v);
            if (pinErr && v) setPinErr(null);
          }}
          onComplete={(v) => void submit(v)}
          label={t.login.mpin}
          hint={t.login.mpinHint}
          error={pinErr}
          shakeKey={shakeKey}
          disabled={busy || lockedFor > 0}
        />

        {lockedFor > 0 && (
          <p
            className="bg-danger-soft text-danger flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
            role="status"
            aria-live="polite"
          >
            <LockKeyhole size={16} aria-hidden />
            {t.login.locked(lockedMin)}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto sm:min-w-44"
            disabled={busy || lockedFor > 0}
          >
            {busy ? (
              t.common.loading
            ) : (
              <>
                {t.login.submit}
                <ArrowRight size={18} aria-hidden />
              </>
            )}
          </button>
          {canBiometric && (
            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => void biometric()}>
              <Fingerprint size={20} aria-hidden />
              {t.login.biometric}
            </button>
          )}
        </div>

        <div className="border-line flex flex-wrap items-center justify-between gap-2 border-t pt-5 text-[0.95rem]">
          <Link href="/forgot-mpin" className="text-accent font-semibold underline-offset-4 hover:underline">
            {t.login.forgot}
          </Link>
          <span className="text-muted">
            {t.login.noAccount}{" "}
            <Link href="/signup" className="text-accent font-semibold underline-offset-4 hover:underline">
              {t.login.create}
            </Link>
          </span>
        </div>
      </form>
    </div>
  );
}
