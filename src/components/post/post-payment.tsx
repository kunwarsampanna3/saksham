"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { MethodPicker } from "@/components/pay/method-picker";
import { PaySheet, type Method, type PayResult } from "@/components/pay/pay-sheet";
import { FREE_EXTRA_DAYS, POST_PLANS, postFee, type PostDays } from "@/lib/business";
import { num, rs } from "@/lib/format";

/** crypto.randomUUID only exists on https and localhost. The site is also opened over a home network. */
function newRequestId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

interface PostPaymentBody {
  requestId: string;
  days: PostDays;
  fee: number;
  method: Method;
}

/**
 * The posting fee, for all three ways of posting: pick the days, then the payment sheet.
 * `submit` sends the post with the payment and returns the new id.
 */
export function usePostPayment(opts: {
  submit: (post: PostPaymentBody) => Promise<{ id?: string; ref?: string; error?: string }>;
  onPosted: (id: string) => void;
  cardFirst?: boolean;
}) {
  const { t, lang } = useI18n();
  const p = t.market.post;
  const [days, setDays] = useState<PostDays>(POST_PLANS[0].days);
  const [method, setMethod] = useState<Method>(opts.cardFirst ? "card_sandbox" : "esewa_sandbox");
  // Made when the sheet first opens and kept, so trying again after a lost reply can't pay twice.
  const [requestId, setRequestId] = useState<string | null>(null);
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);
  const fee = postFee(days);

  const pay = async (): Promise<PayResult> => {
    const r = await opts.submit({ requestId: requestId!, days, fee, method });
    if (!r.id) return { ok: false, error: r.error ?? t.errors.generic };
    setPosted(r.id);
    return { ok: true, ref: r.ref };
  };

  return {
    /** Opens the payment sheet. `title` is what is being posted. */
    open(title: string) {
      setRequestId((id) => id ?? newRequestId());
      setSheetFor(title);
    },
    payLabel: p.pay(rs(fee, lang)),
    picker: (
      <section className="border-line bg-surface space-y-4 rounded-[14px] border p-5" data-post-plan>
        <fieldset>
          <legend className="field-label">{p.title}</legend>
          <div className="grid grid-cols-2 gap-2">
            {POST_PLANS.map((plan) => (
              <label
                key={plan.days}
                className={`cursor-pointer rounded-[4px] border-[1.5px] p-3 ${days === plan.days ? "border-accent bg-accent-soft" : "border-line-strong"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    value={plan.days}
                    checked={days === plan.days}
                    onChange={() => setDays(plan.days)}
                    className="accent-[var(--accent)]"
                  />
                  {p.days(num(plan.days, lang))}
                </span>
                <span className="font-display mt-1 block text-2xl font-extrabold">{rs(plan.fee, lang)}</span>
              </label>
            ))}
          </div>
          <p className="text-muted mt-2 text-sm">{p.free(num(FREE_EXTRA_DAYS, lang))}</p>
        </fieldset>
        <MethodPicker legend={p.method} value={method} onChange={setMethod} cardFirst={opts.cardFirst} />
      </section>
    ),
    sheet: sheetFor !== null && (
      <PaySheet
        method={method}
        amount={fee}
        amountText={rs(fee, lang)}
        headline={p.headline}
        installment={{ seq: 1, of: 1 }}
        taskTitle={sheetFor}
        providerName=""
        details={{
          rows: [
            [t.booking.sheet.for, sheetFor],
            [p.plan, p.planValue(num(days, lang), num(FREE_EXTRA_DAYS, lang))],
            [t.booking.sheet.amount, rs(fee, lang)],
            [t.booking.sheet.method, t.booking.methods[method]],
          ],
          note: p.note,
          doneTitle: p.doneTitle,
          doneNote: p.doneNote,
        }}
        pay={pay}
        onClose={() => setSheetFor(null)}
        onDone={() => {
          setSheetFor(null);
          if (posted) opts.onPosted(posted);
        }}
      />
    ),
  };
}
