"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, useI18n, useUser } from "@/components/providers";
import { TerraceSteps } from "@/components/terrace-steps";
import { PhoneInput, isNepalMobile } from "./phone-input";
import { OtpStep } from "./otp-step";
import { SetMpin } from "./set-mpin";
import type { PublicUser } from "@/lib/store/types";

export function ForgotFlow() {
  const { t } = useI18n();
  const { setUser } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const steps = [t.signup.steps[0], t.signup.steps[1], t.signup.steps[3]];

  const save = async (mpin: string) => {
    setBusy(true); setErr(null);
    const r = await postJson<{ user: PublicUser }>("/api/auth/reset-mpin", { mpin });
    setBusy(false);
    if (r.ok) {
      setUser(r.user);
      router.replace("/");
      router.refresh();
      return;
    }
    if (r.error === "mpin_weak") setErr(t.signup.weak);
    else if (r.error === "otp_required") { setErr(t.errors.otp_required); setStep(0); }
    else setErr(r.error === "offline" ? t.errors.offline : t.errors.generic);
  };

  return (
    <div>
      <h1 className="font-display text-[2rem] font-extrabold sm:text-[2.3rem]">{step === 2 ? t.forgot.newTitle : t.forgot.title}</h1>
      <div className="mt-5"><TerraceSteps steps={steps} current={step} label={t.forgot.title} /></div>

      {step === 0 && (
        <form className="space-y-6" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (!isNepalMobile(phone)) return setPhoneErr(t.errors.phone_invalid);
          setStep(1);
        }}>
          <p className="text-muted">{t.forgot.lead}</p>
          <PhoneInput value={phone} onChange={(v) => { setPhone(v); setPhoneErr(null); }} label={t.login.phone} hint={t.login.phoneHint} error={phoneErr ?? err} autoFocus />
          <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-44">{t.common.continue}</button>
        </form>
      )}
      {step === 1 && <OtpStep phone={phone} purpose="reset" onVerified={() => setStep(2)} onChangeNumber={() => setStep(0)} />}
      {step === 2 && <SetMpin submitLabel={t.common.save} onSubmit={(p) => void save(p)} serverError={err} busy={busy} />}

      <p className="mt-6 border-t border-line pt-5 text-[0.95rem]">
        <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">← {t.login.submit}</Link>
      </p>
    </div>
  );
}
