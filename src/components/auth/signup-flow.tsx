"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Hammer, Repeat2, ArrowLeft } from "lucide-react";
import { postJson, useI18n, useUser } from "@/components/providers";
import { TerraceSteps } from "@/components/terrace-steps";
import { isNepalMobile } from "./phone-input";
import { IdentityInput, isEmailAddress, targetBody, type Channel } from "./identity-input";
import { OtpStep } from "./otp-step";
import { AuthSwitch } from "./auth-switch";
import { SetMpin } from "./set-mpin";
import type { PublicUser } from "@/lib/store/types";

type Role = "client" | "provider" | "both";

export function SignupFlow({ cities }: { cities: readonly string[] }) {
  const { t, lang } = useI18n();
  const { setUser } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [role, setRole] = useState<Role>("client");
  const [aboutErr, setAboutErr] = useState<{ name?: string; city?: string }>({});
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const roles = [
    { v: "client" as const, title: t.signup.roleClient, sub: t.signup.roleClientSub, Icon: Briefcase },
    { v: "provider" as const, title: t.signup.roleProvider, sub: t.signup.roleProviderSub, Icon: Hammer },
    { v: "both" as const, title: t.signup.roleBoth, sub: t.signup.roleBothSub, Icon: Repeat2 },
  ];

  const nameOk = (n: string) => /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{1,59}$/u.test(n.trim());

  const register = async (mpin: string) => {
    setBusy(true); setServerErr(null);
    const r = await postJson<{ user: PublicUser }>("/api/auth/register", { name: name.trim(), city, role, mpin, lang });
    setBusy(false);
    if (r.ok) {
      try { localStorage.setItem(channel === "email" ? "sk_last_email" : "sk_last_phone", channel === "email" ? email.trim().toLowerCase() : phone); localStorage.setItem("sk_last_channel", channel); } catch { /* ignore */ }
      setUser(r.user);
      router.replace("/");
      router.refresh();
      return;
    }
    if (r.error === "mpin_weak") setServerErr(t.signup.weak);
    else if (r.error === "phone_taken") setServerErr(t.signup.taken);
    else if (r.error === "email_taken") setServerErr(t.signup.emailTaken);
    else if (r.error === "otp_required") { setServerErr(t.errors.otp_required); setStep(0); }
    else setServerErr(r.error === "offline" ? t.errors.offline : t.errors.generic);
  };

  return (
    <div>
      {step === 0 && <AuthSwitch active="signup" />}
      <h1 className="font-display text-[2rem] font-extrabold sm:text-[2.3rem]">{t.signup.title}</h1>
      <div className="mt-5"><TerraceSteps steps={t.signup.steps} current={step} label={t.signup.title} /></div>

      {step > 0 && step < 3 && (
        <button type="button" className="btn btn-quiet -ml-2 mb-3" onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft size={16} aria-hidden /> {t.common.back}
        </button>
      )}

      {step === 0 && (
        <form className="space-y-6" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (channel === "phone" && !isNepalMobile(phone)) return setPhoneErr(t.errors.phone_invalid);
          if (channel === "email" && !isEmailAddress(email)) return setPhoneErr(t.errors.email_invalid);
          setStep(1);
        }}>
          <p className="text-muted">{t.signup.phoneLead}</p>
          <IdentityInput channel={channel} onChannel={(c) => { setChannel(c); setPhoneErr(null); setServerErr(null); }}
            phone={phone} onPhone={(v) => { setPhone(v); setPhoneErr(null); }}
            email={email} onEmail={(v) => { setEmail(v); setPhoneErr(null); }}
            error={phoneErr ?? serverErr} autoFocus />
          <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-44">{t.common.continue}</button>
        </form>
      )}

      {step === 1 && (
        <OtpStep target={targetBody(channel, phone, email) as { phone: string } | { email: string }} purpose="signup" onVerified={() => setStep(2)} onChangeNumber={() => setStep(0)} />
      )}

      {step === 2 && (
        <form className="space-y-6" noValidate onSubmit={(e) => {
          e.preventDefault();
          const errs: typeof aboutErr = {};
          if (!nameOk(name)) errs.name = name.trim().length < 2 ? t.errors.name_short : t.errors.name_chars;
          if (!city) errs.city = t.errors.city;
          setAboutErr(errs);
          if (!errs.name && !errs.city) setStep(3);
        }}>
          <div>
            <label htmlFor="su-name" className="field-label">{t.signup.name}</label>
            <input id="su-name" className="input" autoComplete="name" value={name} maxLength={60} autoFocus
              aria-invalid={aboutErr.name ? true : undefined} aria-describedby="su-name-h"
              onChange={(e) => setName(e.target.value)} />
            {aboutErr.name ? <p id="su-name-h" role="alert" className="field-error">{aboutErr.name}</p> : <p id="su-name-h" className="field-hint">{t.signup.nameHint}</p>}
          </div>
          <div>
            <label htmlFor="su-city" className="field-label">{t.signup.city}</label>
            <select id="su-city" className="input appearance-none bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10"
              style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2345564d' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
              value={city} onChange={(e) => setCity(e.target.value)} aria-invalid={aboutErr.city ? true : undefined}>
              <option value="" disabled>{t.signup.cityPlaceholder}</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {aboutErr.city && <p role="alert" className="field-error">{aboutErr.city}</p>}
          </div>
          <fieldset>
            <legend className="field-label">{t.signup.role}</legend>
            <div className="grid gap-2.5">
              {roles.map(({ v, title, sub, Icon }) => (
                <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-md border-[1.5px] p-3 transition-colors ${role === v ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}>
                  <input type="radio" name="role" value={v} checked={role === v} onChange={() => setRole(v)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                  <Icon size={20} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm text-muted">{sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-44">{t.common.continue}</button>
        </form>
      )}

      {step === 3 && (
        <>
          <SetMpin submitLabel={t.signup.done} onSubmit={(p) => void register(p)} serverError={serverErr} busy={busy} />
          <p className="mt-4 text-xs text-muted">{t.signup.terms}</p>
        </>
      )}

      <p className="mt-6 border-t border-line pt-5 text-[0.95rem] text-muted">
        {t.signup.have}{" "}
        <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">{t.login.submit}</Link>
      </p>
    </div>
  );
}
