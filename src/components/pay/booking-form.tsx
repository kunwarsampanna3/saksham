"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, Wallet, FlaskConical } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { useReauth } from "@/components/reauth-dialog";
import { rs, npDate } from "@/lib/format";

type Plan = "full" | "two" | "milestones";
type Method = "esewa_sandbox" | "khalti_sandbox";
type Row = { seq: number; label: "full" | "first" | "second" | "start" | "middle" | "finish"; pct: number; amount: number; dueDate: string };

export function BookingForm({ taskId, total, providerName, feeRate, previews }: {
  taskId: string; total: number; providerName: string; feeRate: number; previews: Record<Plan, Row[]>;
}) {
  const { t, lang } = useI18n();
  const b = t.booking;
  const router = useRouter();
  const { ensureFresh, dialog } = useReauth();
  const [plan, setPlan] = useState<Plan>("milestones");
  const [method, setMethod] = useState<Method>("esewa_sandbox");
  const [sandbox, setSandbox] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const fmtDate = (d: string) => npDate(d, lang, { year: false });
  const first = previews[plan][0];

  const start = async () => {
    setErr(null);
    if (!(await ensureFresh())) return; // MPIN again after 5 minutes idle
    setSandbox(true);
  };

  const pay = async () => {
    setBusy(true); setErr(null);
    let r = await postJson<{ id: string }>("/api/bookings", { taskId, plan, method });
    if (!r.ok && r.error === "reauth_required" && (await ensureFresh())) r = await postJson<{ id: string }>("/api/bookings", { taskId, plan, method });
    setBusy(false);
    if (r.ok && r.id) { router.push(`/payments/${r.id}`); return; }
    setSandbox(false);
    const errs = t.payments.errors;
    setErr(r.error && r.error in errs ? errs[r.error as keyof typeof errs] : t.errors.generic);
    if (r.error === "already_booked") router.refresh();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-7">
        <fieldset>
          <legend className="font-display text-xl font-bold">{b.planTitle}</legend>
          <div className="mt-3 grid gap-3">
            {(["full", "two", "milestones"] as const).map((p) => (
              <label key={p} className={`block cursor-pointer rounded-[4px] border-[1.5px] p-4 transition-colors ${plan === p ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}>
                <div className="flex items-start gap-3">
                  <input type="radio" name="plan" value={p} checked={plan === p} onChange={() => setPlan(p)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                  <div className="flex-1">
                    <span className="font-display block text-lg font-bold">{b.plans[p].title}</span>
                    <span className="block text-sm text-muted">{b.plans[p].sub}</span>
                    {/* the installments as rising terraces */}
                    <ol className="mt-3 flex items-end gap-1.5">
                      {previews[p].map((row, i) => (
                        <li key={row.seq} className="min-w-0" style={{ flex: row.pct }}>
                          <div className={plan === p ? "bg-accent" : "bg-line-strong"} style={{ height: `${8 + i * 7}px`, opacity: 0.55 + i * 0.2 }} aria-hidden />
                          <span className="mt-1 block truncate text-xs font-semibold">{b.labels[row.label]}</span>
                          <span className="block font-display text-sm font-bold">{rs(row.amount, lang)}</span>
                          <span className="block text-xs text-muted">{i === 0 ? b.payNow : b.due(fmtDate(row.dueDate))}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-display text-xl font-bold">{b.method}</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["esewa_sandbox", "khalti_sandbox"] as const).map((m) => (
              <label key={m} className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-4 font-semibold ${method === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}>
                <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--accent)]" />
                <Wallet size={17} aria-hidden /> {b.methods[m]} <span className="demo-tag">{t.common.sandbox}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{b.sandboxNote}</p>
        </fieldset>
      </div>

      <aside className="lg:col-span-5">
        <div className="notch-frame lg:sticky lg:top-[calc(var(--header-h)+16px)]">
          <div className="notch-card terrace-edge space-y-4 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{b.agreed}</p>
              <p className="font-display text-3xl font-extrabold">{rs(total, lang)}</p>
              <p className="text-sm text-muted">{b.with(providerName)}</p>
            </div>
            <dl className="space-y-1.5 border-t border-line pt-3 text-[0.95rem]">
              <div className="flex justify-between"><dt>{b.youPay}</dt><dd className="font-bold">{rs(total, lang)}</dd></div>
              <div className="flex justify-between"><dt>{b.providerGets(providerName.split(" ")[0])}</dt><dd className="font-bold">{rs(Math.round(total * (1 - feeRate)), lang)}</dd></div>
            </dl>
            <p className="text-xs text-muted">{b.feeLine}</p>
            {err && <p role="alert" className="field-error">{err}</p>}
            <button type="button" className="btn btn-primary w-full" onClick={() => void start()} disabled={busy}>
              <LockKeyhole size={17} aria-hidden /> {b.confirm(rs(first.amount, lang))}
            </button>
          </div>
        </div>
      </aside>

      {dialog}
      {sandbox && (
        <SandboxSheet title={b.sandboxTitle(b.methods[method])} body={b.sandboxBody} amount={rs(first.amount, lang)} payLabel={busy ? b.paying : b.sandboxPay}
          cancel={t.common.cancel} busy={busy} onPay={() => void pay()} onClose={() => setSandbox(false)} />
      )}
    </div>
  );
}

/** Stand-in for the wallet's payment screen. Clearly a sandbox: no credentials are asked for, nothing is charged. */
export function SandboxSheet({ title, body, amount, payLabel, cancel, busy, onPay, onClose }: {
  title: string; body: string; amount: string; payLabel: string; cancel: string; busy: boolean; onPay: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }} aria-labelledby="sbx-h"
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-md border border-dashed border-[#c58a00] bg-surface p-0 text-text backdrop:bg-ink/60">
      <div className="p-6 text-center">
        <span className="demo-tag"><FlaskConical size={11} aria-hidden /> Sandbox · demo</span>
        <h2 id="sbx-h" className="font-display mt-3 text-2xl font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{body}</p>
        <p className="font-display mt-4 text-4xl font-extrabold text-accent">{amount}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>{cancel}</button>
          <button type="button" className="btn btn-primary" onClick={onPay} disabled={busy}><Check size={17} aria-hidden /> {payLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
