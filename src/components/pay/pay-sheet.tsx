"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Delete,
  FileText,
  FlaskConical,
  LockKeyhole,
  X,
} from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { npDate } from "@/lib/format";
import { VisaCard } from "./visa-card";

export type Method = "esewa_sandbox" | "khalti_sandbox" | "card_sandbox";
export type PayResult = { ok: boolean; error?: string; ref?: string; receiptHref?: string };
export interface PayDetails {
  rows: [label: string, value: string][];
  note: string;
  doneTitle: string;
  doneNote: string;
}

const BRAND: Record<Method, string> = {
  esewa_sandbox: "bg-[#41a124]", // eSewa-style green
  khalti_sandbox: "bg-[#5c2d91]", // Khalti-style purple
  card_sandbox: "bg-[#1a1f71]", // Visa-style blue
};

/**
 * Payment sheet in three steps, like the prototype:
 *  1. Review: what you pay, for which job, held for whom.
 *  2. MPIN: the 4-digit Saksham MPIN, checked on the server (wrong tries count toward the lock).
 *  3. Success: "Payment held in escrow" with the transaction ID and a receipt.
 * Sandbox only: no real money moves.
 */
export function PaySheet({
  method,
  amount,
  amountText,
  installment,
  taskTitle,
  providerName,
  approx,
  headline,
  pay,
  onDone,
  onClose,
  mode = "pay",
  fee = 0,
  money,
  methodLabel,
  details,
}: {
  method: Method;
  /** When only one brand is offered, e.g. "Visa card" for hiring abroad */
  methodLabel?: string;
  amount: number;
  amountText: string;
  installment: { seq: number; of: number };
  taskTitle: string;
  providerName: string;
  approx?: string;
  /** Shown above the amount in place of "Installment 1 of 3" */
  headline?: string;
  /** "release": the client approves and releases a held installment to the provider */
  mode?: "pay" | "release";
  fee?: number;
  money?: (n: number) => string;
  /** Replaces the escrow wording, for payments that aren't simply "held until you approve" */
  details?: PayDetails;
  pay: () => Promise<PayResult>;
  onDone: (r: PayResult) => void;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const b = t.booking;
  const s = b.sheet;
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<"review" | "mpin" | "done">("review");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<PayResult | null>(null);
  const [at, setAt] = useState<string>("");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      setErr(null);
      const r = await postJson<{ attemptsLeft?: number; retryAfter?: number }>("/api/auth/reauth", {
        mpin: code,
      });
      if (!r.ok) {
        setBusy(false);
        setPin("");
        setErr(
          r.error === "locked"
            ? s.locked
            : r.error === "wrong_credentials"
              ? s.wrong((r as { attemptsLeft?: number }).attemptsLeft ?? 0)
              : r.error === "offline"
                ? t.errors.offline
                : t.errors.generic,
        );
        return;
      }
      const p = await pay();
      setBusy(false);
      if (!p.ok) {
        setPin("");
        setStep("review");
        setErr(p.error ?? t.errors.generic);
        return;
      }
      setResult(p);
      setAt(new Date().toISOString());
      setStep("done");
    },
    [pay, s, t.errors],
  );

  const press = (d: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  // Physical keyboard works too.
  useEffect(() => {
    if (step !== "mpin") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const close = () => {
    if (busy) return;
    if (step === "done" && result) onDone(result);
    else onClose();
  };
  const release = mode === "release";
  const label = methodLabel ?? b.methods[method];
  const fmt = money ?? ((n: number) => String(n));
  const standard: [string, string][] = release
    ? [
        [s.for, taskTitle],
        [s.releaseTo, providerName],
        [s.amount, amountText],
        [s.fee, fmt(fee)],
        [s.receives, fmt(amount - fee)],
      ]
    : [
        [s.for, taskTitle],
        [s.heldFor, providerName],
        [s.amount, amountText],
        [s.method, label],
        [s.serviceCharge, s.serviceFree],
      ];
  const rows = details?.rows ?? standard;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="pay-h"
      className="bg-surface text-text backdrop:bg-ink/60 m-auto max-h-[calc(100dvh-1.5rem)] w-[min(26rem,calc(100vw-1.5rem))] overflow-x-hidden overflow-y-auto rounded-[18px] border-0 p-0 shadow-2xl"
    >
      {/* brand header */}
      <div className={`${BRAND[method]} px-5 pt-4 pb-5 text-white`}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <LockKeyhole size={15} aria-hidden /> {release ? s.releaseHeader : `${label} · ${s.secure}`}
          </span>
          <button
            type="button"
            onClick={close}
            aria-label={t.common.cancel}
            className="grid h-8 w-8 place-items-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="mt-3 text-sm text-white/85">
          {headline ?? s.installmentOf(installment.seq, installment.of)}
        </p>
        <p id="pay-h" className="font-display text-4xl font-extrabold">
          {amountText}
        </p>
        {approx && <p className="mt-0.5 text-sm text-white/85">{approx}</p>}
        <span className="mt-2 inline-flex items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase">
          <FlaskConical size={11} aria-hidden /> {t.common.sandbox}
        </span>
      </div>

      {step === "review" && (
        <div className="p-5">
          <dl className="divide-line divide-y text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          {!release && method === "card_sandbox" && (
            <div className="mt-3">
              <VisaCard />
            </div>
          )}
          <p className="bg-accent-soft mt-3 flex gap-2 rounded-[10px] p-3 text-xs">
            <LockKeyhole size={14} aria-hidden className="text-accent mt-0.5 shrink-0" />{" "}
            {details?.note ??
              (release ? s.releaseNote : method === "card_sandbox" ? b.cardNote : s.escrowNote)}
          </p>
          {err && (
            <p role="alert" className="field-error mt-3">
              {err}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setErr(null);
              setPin("");
              setStep("mpin");
            }}
            className="btn btn-primary mt-4 !min-h-12 w-full"
          >
            {release ? s.approveMpin : s.confirmMpin} <ArrowRight size={17} aria-hidden />
          </button>
        </div>
      )}

      {step === "mpin" && (
        <div className="p-5 text-center">
          <p className="font-display text-lg font-bold">{s.enterMpin}</p>
          <div className="mt-3 flex justify-center gap-3" aria-label={s.digits(pin.length)} role="status">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full border-2 ${i < pin.length ? "border-accent bg-accent" : "border-line-strong"}`}
              />
            ))}
          </div>
          <p className="text-muted mt-2 text-xs">{busy ? s.checking : s.mpinNote}</p>
          {err && (
            <p role="alert" className="field-error mt-2">
              {err}
            </p>
          )}
          <div className="mx-auto mt-4 grid max-w-[16rem] grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => press(d)}
                disabled={busy}
                className="bg-surface-2 font-display hover:bg-accent-soft h-14 rounded-[12px] text-xl font-bold disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setStep("review");
                setPin("");
                setErr(null);
              }}
              disabled={busy}
              className="text-muted hover:bg-surface-2 h-14 rounded-[12px] text-sm font-semibold"
            >
              {s.back}
            </button>
            <button
              type="button"
              onClick={() => press("0")}
              disabled={busy}
              className="bg-surface-2 font-display hover:bg-accent-soft h-14 rounded-[12px] text-xl font-bold disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => setPin((p) => p.slice(0, -1))}
              disabled={busy}
              aria-label={s.del}
              className="hover:bg-surface-2 grid h-14 place-items-center rounded-[12px]"
            >
              <Delete size={20} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="p-5 text-center">
          <span className="bg-accent mx-auto grid h-16 w-16 place-items-center rounded-full text-white">
            <Check size={34} aria-hidden />
          </span>
          <p className="font-display mt-3 text-xl font-bold">
            {details?.doneTitle ?? (release ? s.releasedTitle : s.heldTitle)}
          </p>
          <p className="text-muted text-sm">
            {at ? npDate(at, lang) : ""} ·{" "}
            {new Date(at || Date.now()).toLocaleTimeString(lang === "ne" ? "ne-NP" : "en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <dl className="divide-line border-line mt-4 divide-y rounded-[12px] border text-left text-sm">
            {result.ref && (
              <div className="flex justify-between gap-3 px-3 py-2.5">
                <dt className="text-muted">{s.txn}</dt>
                <dd className="font-mono font-semibold">{result.ref}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 px-3 py-2.5">
              <dt className="text-muted">{s.amount}</dt>
              <dd className="font-semibold">{amountText}</dd>
            </div>
            <div className="flex justify-between gap-3 px-3 py-2.5">
              <dt className="text-muted">{s.method}</dt>
              <dd className="font-semibold">{label}</dd>
            </div>
          </dl>
          <p className="text-muted mt-3 inline-flex items-center gap-1.5 text-xs">
            <CheckCircle2 size={14} aria-hidden className="text-accent" />{" "}
            {details?.doneNote ??
              (release ? s.releasedNote(providerName, fmt(amount - fee)) : s.heldNote(providerName))}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {result.receiptHref ? (
              <Link href={result.receiptHref} className="btn btn-ghost !min-h-12">
                <FileText size={16} aria-hidden /> {s.receipt}
              </Link>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => onDone(result)} className="btn btn-primary !min-h-12">
              {s.done}
            </button>
          </div>
        </div>
      )}
      <span className="sr-only">{amount}</span>
    </dialog>
  );
}
