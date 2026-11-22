"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Send } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { PaySheet, type PayResult } from "@/components/pay/pay-sheet";
import { num, rs } from "@/lib/format";
import { splitAdvance } from "@/lib/business";
import { jobPayment } from "@/components/pay/job-money";

function useJobAction(jobId: string) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const errors = t.abroadJobs.errors;
  const text = (code?: string) =>
    code && code in errors ? errors[code as keyof typeof errors] : t.errors.generic;
  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    const r = await postJson(`/api/abroad/jobs/${jobId}`, body);
    setBusy(false);
    if (!r.ok) setErr(text(r.error));
    router.refresh();
  };
  return { busy, err, run, text };
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="field-error mt-2">
      {text}
    </p>
  ) : null;
}

export function ApplyForm({ jobId, country }: { jobId: string; country: string }) {
  const { t } = useI18n();
  const j = t.abroadJobs;
  const { busy, err, run } = useJobAction(jobId);
  const [note, setNote] = useState("");
  const [eligible, setEligible] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run({ action: "apply", note, eligible });
      }}
    >
      <h2 className="font-display text-xl font-bold">{j.applyTitle}</h2>
      <label className="block">
        <span className="field-label">{j.note}</span>
        <textarea
          name="note"
          className="input resize-y py-3"
          rows={3}
          maxLength={500}
          placeholder={j.notePh}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm font-semibold">
        <input
          name="eligible"
          type="checkbox"
          checked={eligible}
          onChange={(e) => setEligible(e.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        {j.eligible(country)}
      </label>
      <button type="submit" className="btn btn-primary w-full" disabled={busy || !eligible}>
        <Send size={16} aria-hidden /> {j.apply}
      </button>
      <ErrorLine text={err} />
    </form>
  );
}

/** withdraw, decline, close or reopen. */
export function JobActionButton({
  jobId,
  action,
  applicationId,
}: {
  jobId: string;
  action: "withdraw" | "decline" | "close" | "reopen";
  applicationId?: string;
}) {
  const { t } = useI18n();
  const j = t.abroadJobs;
  const { busy, err, run } = useJobAction(jobId);
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        className={`btn !min-h-10 ${action === "reopen" ? "btn-primary" : "btn-quiet"}`}
        onClick={() => {
          if (action === "close" && !window.confirm(j.closeConfirm)) return;
          void run({ action, applicationId });
        }}
      >
        {j[action]}
      </button>
      <ErrorLine text={err} />
    </div>
  );
}

/** Hire one applicant: Visa test card, then MPIN, then the pay is held in escrow. */
export function HireButton({
  jobId,
  applicationId,
  amount,
  title,
  workerName,
  seat,
  seats,
  approx,
}: {
  jobId: string;
  applicationId: string;
  amount: number;
  title: string;
  workerName: string;
  seat: number;
  seats: number;
  approx?: string;
}) {
  const { t, lang } = useI18n();
  const j = t.abroadJobs;
  const router = useRouter();
  const { text } = useJobAction(jobId);
  // Frozen when the sheet opens, so the header doesn't change under it.
  const [opened, setOpened] = useState<{ seq: number; of: number } | null>(null);

  const pay = async (): Promise<PayResult> => {
    const r = await postJson<{ bookingId: string; ref?: string; receiptId?: string }>(
      `/api/abroad/jobs/${jobId}`,
      { action: "hire", applicationId, amount },
    );
    if (!r.ok) return { ok: false, error: text(r.error) };
    return {
      ok: true,
      ref: r.ref,
      receiptHref: r.receiptId ? `/payments/${r.bookingId}/receipt/${r.receiptId}` : undefined,
    };
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-primary !min-h-10"
        onClick={() => setOpened({ seq: seat, of: seats })}
      >
        <CreditCard size={16} aria-hidden /> {j.hire}
      </button>
      {opened && (
        <PaySheet
          method="card_sandbox"
          methodLabel={j.visa}
          amount={splitAdvance(amount).firstPayment}
          amountText={rs(splitAdvance(amount).firstPayment, lang)}
          details={jobPayment("first", { t, lang, total: amount, task: title, name: workerName })}
          installment={{ seq: 1, of: 1 }}
          headline={j.seats(num(opened.seq, lang), num(opened.of, lang))}
          taskTitle={title}
          providerName={workerName}
          approx={approx}
          pay={pay}
          onClose={() => {
            setOpened(null);
            router.refresh();
          }}
          onDone={() => {
            setOpened(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
