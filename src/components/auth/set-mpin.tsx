"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/components/providers";
import { MpinInput, type MpinHandle } from "./mpin-input";

const WEAK = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "0123",
  "9876",
  "1212",
  "2580",
  "1122",
]);

/** Enter + confirm a new MPIN. Calls onSubmit(pin) once both match and the PIN isn't trivially weak. */
export function SetMpin({
  submitLabel,
  onSubmit,
  serverError,
  busy,
}: {
  submitLabel: string;
  onSubmit: (pin: string) => void;
  serverError?: string | null;
  busy?: boolean;
}) {
  const { t } = useI18n();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const second = useRef<MpinHandle>(null);

  const submit = () => {
    setErr(null);
    if (a.length !== 4) return setErr(t.errors.mpin_format);
    if (WEAK.has(a)) {
      setShake((s) => s + 1);
      return setErr(t.signup.weak);
    }
    if (a !== b) {
      setShake((s) => s + 1);
      setB("");
      return setErr(t.signup.mismatch);
    }
    onSubmit(a);
  };

  const shown = err ?? serverError ?? null;

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-muted">{t.signup.mpinLead}</p>
      <MpinInput
        value={a}
        onChange={(v) => {
          setA(v);
          setErr(null);
        }}
        onComplete={() => second.current?.focus()}
        label={t.signup.mpinTitle}
        autoFocus
      />
      <MpinInput
        ref={second}
        value={b}
        onChange={(v) => {
          setB(v);
          setErr(null);
        }}
        label={t.signup.mpinConfirm}
        error={shown}
        shakeKey={shake}
        allowReveal={false}
      />
      <button
        type="submit"
        className="btn btn-primary w-full sm:w-auto sm:min-w-48"
        disabled={busy || a.length !== 4 || b.length !== 4}
      >
        {busy ? t.common.loading : submitLabel}
      </button>
    </form>
  );
}
