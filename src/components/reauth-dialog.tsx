"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { postJson, useI18n } from "./providers";
import { MpinInput, type MpinHandle } from "./auth/mpin-input";

/**
 * Payment gate. Call `ensureFresh()` before any payment action:
 * resolves true immediately if MPIN was entered in the last 5 minutes,
 * otherwise opens an MPIN dialog and resolves when the user confirms or cancels.
 */
export function useReauth() {
  const [open, setOpen] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const ensureFresh = useCallback(async () => {
    const me = await fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null);
    if (me && me.user && me.paymentReauth === false) return true;
    setOpen(true);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  const dialog = open ? <ReauthDialog onDone={finish} /> : null;
  return { ensureFresh, dialog };
}

function ReauthDialog({ onDone }: { onDone: (ok: boolean) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const pin = useRef<MpinHandle>(null);
  const [mpin, setMpin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
    setTimeout(() => pin.current?.focus(), 30);
  }, []);

  const submit = async (v = mpin) => {
    if (v.length !== 4) return;
    setBusy(true);
    setErr(null);
    const r = await postJson<{ attemptsLeft?: number; retryAfter?: number }>("/api/auth/reauth", { mpin: v });
    setBusy(false);
    if (r.ok) return onDone(true);
    setMpin("");
    setShake((s) => s + 1);
    if (r.error === "wrong_credentials")
      setErr(`${t.reauth.wrong} ${t.login.attemptsLeft(r.attemptsLeft ?? 0)}`);
    else if (r.error === "locked") setErr(t.login.locked(Math.ceil((r.retryAfter ?? 900) / 60)));
    else setErr(t.errors.generic);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="reauth-title"
      onCancel={(e) => {
        e.preventDefault();
        onDone(false);
      }}
      className="border-line bg-surface text-text backdrop:bg-ink/60 m-auto w-[min(26rem,calc(100vw-2rem))] rounded-md border p-0"
    >
      <form
        method="dialog"
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <span className="bg-accent-soft text-accent inline-flex h-11 w-11 items-center justify-center rounded-md">
          <LockKeyhole size={22} aria-hidden />
        </span>
        <h2 id="reauth-title" className="font-display mt-3 text-2xl font-bold">
          {t.reauth.title}
        </h2>
        <p className="text-muted mt-1">{t.reauth.lead}</p>
        <div className="mt-5">
          <MpinInput
            ref={pin}
            value={mpin}
            onChange={setMpin}
            onComplete={(v) => void submit(v)}
            label={t.login.mpin}
            error={err}
            shakeKey={shake}
            disabled={busy}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => onDone(false)}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || mpin.length !== 4}>
            {t.reauth.confirm}
          </button>
        </div>
      </form>
    </dialog>
  );
}
