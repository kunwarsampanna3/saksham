"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { EXAMPLE_FX } from "@/lib/geo";
import { netOfFee, splitAdvance } from "@/lib/business";
import { rs, num } from "@/lib/format";
import { jobPayment } from "./job-money";
import { MethodPicker } from "./method-picker";
import { PaySheet, type Method, type PayResult } from "./pay-sheet";
import { PlanSteps } from "./plan-steps";

export function BookingForm({
  taskId,
  taskTitle = "",
  total,
  providerName,
  dates,
  abroad = null,
}: {
  taskId: string;
  taskTitle?: string;
  total: number;
  providerName: string;
  dates: { start: string; half: string; end: string };
  /** country of the person paying from abroad, if this is a family-abroad task */
  abroad?: string | null;
}) {
  const { t, lang } = useI18n();
  const b = t.booking;
  const router = useRouter();
  const m = t.market.money;
  const [method, setMethod] = useState<Method>(abroad ? "card_sandbox" : "esewa_sandbox");
  const fx = abroad ? EXAMPLE_FX[abroad as keyof typeof EXAMPLE_FX] : undefined;
  const [sheet, setSheet] = useState(false);
  const { firstPayment } = splitAdvance(total);
  const firstName = providerName.split(" ")[0];
  const [bookingId, setBookingId] = useState<string | null>(null);

  const pay = async (): Promise<PayResult> => {
    const r = await postJson<{ id: string; ref?: string; receiptId?: string }>("/api/bookings", {
      taskId,
      method,
    });
    if (r.ok && r.id) {
      setBookingId(r.id);
      return {
        ok: true,
        ref: r.ref,
        receiptHref: r.receiptId ? `/payments/${r.id}/receipt/${r.receiptId}` : undefined,
      };
    }
    const errs = t.payments.errors;
    if (r.error === "already_booked") router.refresh();
    return {
      ok: false,
      error: r.error && r.error in errs ? errs[r.error as keyof typeof errs] : t.errors.generic,
    };
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-7">
        <section aria-labelledby="plan-h">
          <h2 id="plan-h" className="font-display mb-3 text-xl font-bold">
            {m.planTitle}
          </h2>
          <PlanSteps total={total} dates={dates} />
        </section>
        <MethodPicker
          legend={b.method}
          value={method}
          onChange={setMethod}
          cardFirst={!!abroad}
          cardHint={abroad ? b.cardFor : undefined}
        />
      </div>

      <aside className="lg:col-span-5">
        <div className="notch-frame lg:sticky lg:top-[calc(var(--header-h)+16px)]">
          <div className="notch-card terrace-edge space-y-4 p-5">
            <div>
              <p className="text-muted text-xs font-semibold tracking-wider uppercase">{b.agreed}</p>
              <p className="font-display text-3xl font-extrabold">{rs(total, lang)}</p>
              <p className="text-muted text-sm">{b.with(providerName)}</p>
            </div>
            <dl className="border-line space-y-1.5 border-t pt-3 text-[0.95rem]">
              <div className="flex justify-between gap-3">
                <dt>{b.payNow}</dt>
                <dd className="font-bold">{rs(firstPayment, lang)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{b.youPay}</dt>
                <dd className="font-bold">{rs(total, lang)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{m.gets(firstName)}</dt>
                <dd className="font-bold">{rs(netOfFee(total), lang)}</dd>
              </div>
            </dl>
            <p className="bg-surface-2 rounded-[4px] p-3 text-sm">{m.nonRefundable}</p>
            <p className="text-muted text-xs">{m.feeNote}</p>
            <button type="button" className="btn btn-primary w-full" onClick={() => setSheet(true)}>
              <LockKeyhole size={17} aria-hidden /> {m.confirm(rs(firstPayment, lang))}
            </button>
          </div>
        </div>
      </aside>

      {sheet && (
        <PaySheet
          method={method}
          amount={firstPayment}
          amountText={rs(firstPayment, lang)}
          headline={m.firstTitle}
          installment={{ seq: 1, of: 3 }}
          taskTitle={taskTitle}
          providerName={providerName}
          details={jobPayment("first", { t, lang, total, task: taskTitle, name: providerName })}
          pay={pay}
          approx={
            fx ? b.approx(fx.code, num(Math.max(1, Math.round(firstPayment / fx.nprPer)), lang)) : undefined
          }
          onClose={() => setSheet(false)}
          onDone={() => {
            if (bookingId) router.push(`/payments/${bookingId}`);
          }}
        />
      )}
    </div>
  );
}
