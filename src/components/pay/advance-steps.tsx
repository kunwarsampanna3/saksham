"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Send, Unlock } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { splitAdvance } from "@/lib/business";
import { npDate, rs } from "@/lib/format";
import { jobPayment } from "./job-money";
import { PaySheet, type PayResult } from "./pay-sheet";
import { PlanSteps, type StepState } from "./plan-steps";
import type { ScheduleProps } from "./schedule";

/** The payment page of a booking under the 50% advance rules: its three steps, and the next thing to press. */
export function AdvanceSteps({ p, errText }: { p: ScheduleProps; errText: (e?: string) => string }) {
  const { t, lang } = useI18n();
  const m = t.market.money;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"second" | "last" | null>(null);

  const piece = (label: string) => p.installments.find((i) => i.label === label)!;
  const finish = piece("finish");
  const secondPaid = piece("half").state === "released";
  const done = finish.state === "released";
  const active = p.status === "active";
  const off: StepState = p.status === "refunded" ? "cancelled" : "later";
  const states: [StepState, StepState, StepState] = [
    "done",
    secondPaid ? "done" : active ? "now" : off,
    done ? "done" : secondPaid && active ? "now" : off,
  ];

  const total = p.installments.reduce((a, i) => a + i.amount, 0);
  const { secondPayment, payouts } = splitAdvance(total);
  const client = p.role === "client";
  const provider = p.role === "provider";
  const standIn = client && p.providerIsExample && p.demoMode;

  const tell = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    const r = await postJson(`/api/bookings/${p.bookingId}`, body);
    setBusy(false);
    if (!r.ok) setErr(errText(r.error));
    else router.refresh();
  };
  const pay = async (): Promise<PayResult> => {
    const body = sheet === "second" ? { action: "second" } : { action: "release", installmentId: finish.id };
    const r = await postJson<{ ref?: string; receiptId?: string }>(`/api/bookings/${p.bookingId}`, body);
    if (!r.ok) return { ok: false, error: errText(r.error) };
    return {
      ok: true,
      ref: r.ref,
      receiptHref: r.receiptId ? `/payments/${p.bookingId}/receipt/${r.receiptId}` : undefined,
    };
  };

  const waiting = (text: string) => <p className="text-muted mt-3 text-sm font-semibold">{text}</p>;

  const atHalf = active && !secondPaid && (
    <>
      {p.halfDoneAt ? (
        <>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 size={16} aria-hidden className="text-accent shrink-0" />
            {m.saidHalf(npDate(p.halfDoneAt, lang))}
          </p>
          {client && (
            <button type="button" className="btn btn-primary mt-3" onClick={() => setSheet("second")}>
              <Lock size={16} aria-hidden /> {m.paySecond(rs(secondPayment, lang))}
            </button>
          )}
          {provider && waiting(m.waitSecond)}
        </>
      ) : provider || standIn ? (
        <>
          <button
            type="button"
            className="btn btn-primary mt-3"
            disabled={busy}
            onClick={() => void tell({ action: "half" })}
          >
            <Send size={16} aria-hidden /> {provider ? m.sayHalf : m.sayHalfDemo}
          </button>
          <p className="text-muted mt-1.5 text-sm">{m.sayHalfHelp}</p>
        </>
      ) : (
        waiting(m.waitHalf)
      )}
    </>
  );

  const atFinish = active && secondPaid && !done && (
    <>
      {finish.state === "held" && client && !standIn && waiting(m.waitFinish)}
      {finish.state === "delivered" && provider && waiting(m.waitApprove)}
      <div className="flex flex-wrap gap-2">
        {finish.state === "held" && (provider || standIn) && (
          <button
            type="button"
            className={`btn mt-3 ${provider ? "btn-primary" : "btn-ghost"}`}
            disabled={busy}
            onClick={() => void tell({ action: "deliver", installmentId: finish.id })}
          >
            <Send size={16} aria-hidden /> {provider ? m.sayFinished : m.sayFinishedDemo}
          </button>
        )}
        {client && (
          <button type="button" className="btn btn-primary mt-3" onClick={() => setSheet("last")}>
            <Unlock size={16} aria-hidden /> {m.approve(rs(payouts.finish, lang))}
          </button>
        )}
      </div>
    </>
  );

  const second = sheet === "second";
  const amount = second ? secondPayment : payouts.finish;
  return (
    <>
      {err && (
        <p role="alert" className="field-error">
          {err}
        </p>
      )}
      <PlanSteps
        total={total}
        states={states}
        dates={{ start: piece("advance").dueDate, half: piece("half").dueDate, end: finish.dueDate }}
      >
        {[null, atHalf, atFinish]}
      </PlanSteps>
      {sheet && (
        <PaySheet
          mode={second ? "pay" : "release"}
          method={p.method}
          amount={amount}
          amountText={rs(amount, lang)}
          headline={second ? m.secondTitle : m.steps.finish}
          installment={{ seq: second ? 2 : 3, of: 3 }}
          taskTitle={p.taskTitle ?? ""}
          providerName={p.providerName}
          details={jobPayment(sheet, { t, lang, total, task: p.taskTitle ?? "", name: p.providerName })}
          pay={pay}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
