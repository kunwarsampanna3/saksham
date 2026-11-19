"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, BadgeCheck, Landmark, Star, FileText, Info, FlaskConical, Check, X } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { useReauth } from "@/components/reauth-dialog";
import { rs, npDate, num } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";
import { CATEGORIES } from "@/lib/pricing";
import { monthlyInstallment, EXAMPLE_CREDIT_RATE, type CreditOffer } from "@/lib/rules";

interface Passport { completedJobs: number; verifiedEarnings: number; rating: number; ratingCount: number; categories: string[]; since: string; verified: boolean; isExample: boolean }
export interface WalletData {
  provider: { releasedGross: number; fees: number; earnedNet: number; inEscrow: number; scheduled: number; paidOut: number; available: number };
  client: { paidIn: number; inEscrow: number; released: number; refunded: number };
  receipts: { id: string; bookingId: string; taskTitle: string; kind: "hold" | "release" | "refund"; amount: number; fee: number; receiptNo: string; createdAt: string; role: "client" | "provider" }[];
  payouts: { id: string; amount: number; method: "esewa_sandbox" | "khalti_sandbox" | "card_sandbox"; ref: string; createdAt: string }[];
  passport: Passport; examplePassport: Passport | null; credit: CreditOffer; exampleCredit: CreditOffer | null;
  applications: { id: string; amount: number; months: number; createdAt: string }[];
}

export function WalletView({ data, isProvider, qrSvg, passportUrl }: { data: WalletData; isProvider: boolean; qrSvg: string; passportUrl: string }) {
  const { t, lang } = useI18n();
  const w = t.wallet;
  const router = useRouter();
  const { ensureFresh, dialog } = useReauth();
  const [tab, setTab] = useState<"provider" | "client">(isProvider ? "provider" : "client");
  const [useExample, setUseExample] = useState(!!data.examplePassport && data.passport.completedJobs < 3);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const passport = useExample && data.examplePassport ? data.examplePassport : data.passport;
  const credit = useExample && data.exampleCredit ? data.exampleCredit : data.credit;
  const errText = (e?: string) => (e && e in w.errors ? w.errors[e as keyof typeof w.errors] : e === "offline" ? t.errors.offline : t.errors.generic);

  /** money actions: MPIN first, retry once if the server says the MPIN is stale */
  const moneyPost = async (body: Record<string, unknown>) => {
    if (!(await ensureFresh())) return { ok: false, error: "cancelled" } as { ok: boolean; error?: string; ref?: string };
    let r = await postJson<{ ref?: string }>("/api/wallet", body);
    if (!r.ok && r.error === "reauth_required" && (await ensureFresh())) r = await postJson<{ ref?: string }>("/api/wallet", body);
    return r;
  };

  const Stat = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <div className="bg-surface p-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`font-display mt-1 font-extrabold ${strong ? "text-3xl text-accent" : "text-xl"}`}>{rs(value, lang)}</dd>
    </div>
  );

  return (
    <div className="space-y-12">
      <p className="flex items-start gap-2 text-sm text-muted"><span className="demo-tag shrink-0">{t.common.sandbox}</span> {w.sandbox}</p>
      {notice && <p role="status" className="flex items-center gap-2 rounded-[4px] bg-accent-soft p-3 font-semibold text-accent"><Check size={17} aria-hidden /> {notice}</p>}

      {/* balances */}
      <section aria-labelledby="bal-h">
        <h2 id="bal-h" className="sr-only">{w.title}</h2>
        <div role="tablist" aria-label={w.title} className="inline-flex rounded-[5px] border border-line-strong bg-surface p-1">
          {(["provider", "client"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)}
              className={`min-h-10 rounded-[4px] px-4 font-semibold ${tab === k ? "bg-accent text-accent-contrast" : "hover:text-accent"}`}>{w.tabs[k]}</button>
          ))}
        </div>
        {tab === "provider" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="notch-frame lg:col-span-4">
              <div className="notch-card terrace-edge flex h-full flex-col justify-between p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{w.available}</p>
                  <p className="font-display text-4xl font-extrabold text-accent">{rs(data.provider.available, lang)}</p>
                </div>
                <button type="button" className="btn btn-primary mt-4" disabled={data.provider.available < 100 || !isProvider} onClick={() => setWithdrawOpen(true)}>
                  <ArrowDownToLine size={17} aria-hidden /> {w.withdraw}
                </button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line lg:col-span-8 lg:grid-cols-3">
              <Stat label={w.inEscrow} value={data.provider.inEscrow} />
              <Stat label={w.scheduled} value={data.provider.scheduled} />
              <Stat label={w.releasedGross} value={data.provider.releasedGross} />
              <Stat label={w.fees} value={data.provider.fees} />
              <Stat label={w.earned} value={data.provider.earnedNet} />
              <Stat label={w.paidOut} value={data.provider.paidOut} />
            </dl>
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line lg:grid-cols-4">
            <Stat label={w.paidIn} value={data.client.paidIn} strong />
            <Stat label={w.clientEscrow} value={data.client.inEscrow} />
            <Stat label={w.released} value={data.client.released} />
            <Stat label={w.refunded} value={data.client.refunded} />
          </dl>
        )}
      </section>

      {/* Passport + Credit */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section id="passport" aria-labelledby="pp-h" className="relative overflow-hidden rounded-[4px] bg-forest p-6 text-[#d9e8dd]">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="pp-h" className="font-display text-2xl font-bold text-white">{t.passport.title}</h2>
              <p className="mt-1 max-w-md text-sm">{t.passport.lead}</p>
            </div>
            {passport.isExample && <span className="demo-tag !border-white/40 !bg-white/10 !text-white">{t.passport.example}</span>}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <div className="h-28 w-28 shrink-0 rounded-[4px] bg-white p-1.5" role="img" aria-label={`${t.passport.scan}: ${passportUrl}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <dl className="grid flex-1 grid-cols-2 gap-3">
              <div><dt className="text-xs uppercase tracking-wider text-leaf">{t.passport.jobs}</dt><dd className="font-display text-2xl font-extrabold text-white">{num(passport.completedJobs, lang)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-leaf">{t.passport.earnings}</dt><dd className="font-display text-2xl font-extrabold text-white">{rs(passport.verifiedEarnings, lang)}</dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-leaf">{t.passport.rating}</dt>
                <dd className="font-display flex items-center gap-1 text-2xl font-extrabold text-white"><Star size={18} aria-hidden className="fill-marigold text-marigold" />
                  {passport.ratingCount ? (lang === "ne" ? toDeva(passport.rating.toFixed(1)) : passport.rating.toFixed(1)) : "—"}
                  <span className="text-xs font-normal text-[#b7cdbd]">{t.passport.ratingCount(passport.ratingCount)}</span></dd></div>
              <div><dt className="text-xs uppercase tracking-wider text-leaf">{passport.verified ? t.passport.verified : t.passport.notVerified}</dt>
                <dd className="mt-1 text-sm">{passport.verified ? <BadgeCheck size={22} aria-hidden className="text-leaf" /> : <Link href="/verification" className="underline">{t.nav.verification}</Link>}</dd></div>
            </dl>
          </div>
          {passport.categories.length > 0 && (
            <p className="mt-3 text-sm">{passport.categories.map((c) => { const x = CATEGORIES.find((k) => k.id === c); return x ? (lang === "ne" ? x.ne : x.en) : c; }).join(" · ")}</p>
          )}
          <p className="mt-2 text-xs text-[#b7cdbd]">{t.passport.since(npDate(passport.since, lang, { year: true }))}</p>
          {passport.isExample && <p className="mt-3 text-xs text-[#f6d27a]">{t.passport.exampleNote}</p>}
          {!passport.isExample && passport.completedJobs === 0 && <p className="mt-3 text-sm">{t.passport.none}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={passportUrl.replace(/^https?:\/\/[^/]+/, "")} className="btn btn-ghost !min-h-10 !border-white/40 !text-white">{t.passport.share}</Link>
            {data.examplePassport && (
              <button type="button" className="btn btn-quiet !min-h-10 !text-leaf" onClick={() => setUseExample((v) => !v)}>
                <FlaskConical size={15} aria-hidden /> {useExample ? t.passport.showReal : t.passport.showExample}
              </button>
            )}
          </div>
        </section>

        <section id="credit" aria-labelledby="cr-h" className="notch-frame">
          <div className="notch-card terrace-edge h-full p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 id="cr-h" className="font-display text-2xl font-bold">{t.credit.title}</h2>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Landmark size={16} aria-hidden /> {t.credit.partner} <span className="demo-tag">{t.common.demo}</span></span>
            </div>
            <p className="mt-1 text-[0.95rem]">{t.credit.simple.what}</p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {t.credit.simple.steps.map((st, i) => (
                <li key={st} className="flex gap-2 rounded-[10px] bg-surface-2 p-3 text-sm">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-contrast">{i + 1}</span> {st}
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <p className="text-sm font-semibold">{t.credit.simple.progress(passport.completedJobs)}</p>
              <div className="mt-1 h-2.5 max-w-sm overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, Math.round((passport.completedJobs / 3) * 100))}%` }} /></div>
            </div>
            <p className="mt-3 rounded-[10px] border-l-4 border-accent bg-accent-soft p-3 text-sm"><strong>{t.credit.simple.exampleTitle}: </strong>{t.credit.simple.example}</p>
            <p className="mt-2 text-xs text-muted">{t.credit.lead} {t.credit.simple.partnerNote}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">{t.credit.limit}{passport.isExample ? ` · ${t.passport.example}` : ""}</p>
            <p className="font-display text-4xl font-extrabold text-accent">{credit.eligible ? rs(credit.limit, lang) : t.credit.notYet}</p>
            {credit.jobsNeeded > 0 && <p className="mt-1 text-sm font-semibold">{t.credit.jobsNeeded(credit.jobsNeeded)}</p>}
            {credit.halved && credit.eligible && <p className="mt-1 text-sm">{t.credit.halved}</p>}
            {credit.capped && <p className="mt-1 text-sm">{t.credit.capped}</p>}
            <details className="mt-4 rounded-[4px] bg-surface-2 p-3 text-sm">
              <summary className="cursor-pointer font-semibold">{t.credit.howTitle}</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                <li>{t.credit.rule1(rs(credit.base, lang))}</li>
                <li>{t.credit.rule2}</li>
                <li>{t.credit.rule3}</li>
                <li>{t.credit.rule4}</li>
              </ul>
            </details>
            <button type="button" className="btn btn-primary mt-5" disabled={!credit.eligible || !isProvider} onClick={() => setApplyOpen(true)}>{t.credit.apply}</button>
            {data.applications.length > 0 && (
              <div className="mt-5 border-t border-line pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.credit.applications}</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {data.applications.map((a) => <li key={a.id} className="flex justify-between gap-2"><span>{rs(a.amount, lang)} · {t.credit.monthsN(a.months)}</span><span className="text-muted">{t.credit.status} · {npDate(a.createdAt, lang)}</span></li>)}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* receipts + payouts */}
      <div className="grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="rc-h" className="lg:col-span-8">
          <h2 id="rc-h" className="font-display text-xl font-bold">{w.receipts}</h2>
          {data.receipts.length === 0 ? <p className="mt-2 text-muted">{w.noReceipts}</p> : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {data.receipts.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{t.payments.receiptKinds[r.kind]} — {r.taskTitle}</span>
                    <span className="block text-sm text-muted">{r.receiptNo} · {npDate(r.createdAt, lang)} · {r.role === "client" ? w.asClient : w.asProvider}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-display font-bold">{rs(r.amount, lang)}</span>
                    <Link href={`/payments/${r.bookingId}/receipt/${r.id}`} className="btn btn-quiet !min-h-9 text-sm"><FileText size={15} aria-hidden /> {t.payments.viewReceipt}</Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-6 lg:col-span-4">
          <section aria-labelledby="po-h">
            <h2 id="po-h" className="font-display text-xl font-bold">{w.payouts}</h2>
            {data.payouts.length === 0 ? <p className="mt-2 text-muted">{w.noPayouts}</p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.payouts.map((p) => (
                  <li key={p.id} className="rounded-[4px] border border-line p-3">
                    <span className="flex justify-between font-semibold"><span>{t.booking.methods[p.method]}</span><span>{rs(p.amount, lang)}</span></span>
                    <span className="block text-xs text-muted">{p.ref} · {npDate(p.createdAt, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section id="fees" aria-labelledby="fees-h" className="rounded-[4px] bg-surface-2 p-4">
            <h2 id="fees-h" className="font-display flex items-center gap-2 text-lg font-bold"><Info size={17} aria-hidden className="text-accent" /> {w.feesTitle}</h2>
            <p className="mt-1 text-sm text-muted">{w.feesBody}</p>
          </section>
        </aside>
      </div>

      {dialog}
      {withdrawOpen && (
        <WithdrawDialog max={data.provider.available} onClose={() => setWithdrawOpen(false)} errText={errText}
          onSubmit={async (amount, method) => {
            const r = await moneyPost({ action: "payout", amount, method });
            if (r.ok) { setWithdrawOpen(false); setNotice(w.withdrawn(r.ref ?? "")); router.refresh(); return null; }
            return r.error === "cancelled" ? null : errText(r.error);
          }} />
      )}
      {applyOpen && (
        <ApplyDialog limit={credit.limit} onClose={() => setApplyOpen(false)}
          onSubmit={async (amount, months, purpose) => {
            const r = await moneyPost({ action: "credit", amount, months, purpose, example: useExample });
            if (r.ok) { setApplyOpen(false); setNotice(t.credit.submitted); router.refresh(); return null; }
            return r.error === "cancelled" ? null : errText(r.error);
          }} />
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }} aria-label={title}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-0 text-text backdrop:bg-ink/60">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent-soft" aria-label="Close"><X size={18} aria-hidden /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function WithdrawDialog({ max, onClose, onSubmit, errText }: { max: number; onClose: () => void; onSubmit: (a: number, m: "esewa_sandbox" | "khalti_sandbox") => Promise<string | null>; errText: (e?: string) => string }) {
  const { t, lang } = useI18n();
  const w = t.wallet;
  const [amount, setAmount] = useState(max);
  const [method, setMethod] = useState<"esewa_sandbox" | "khalti_sandbox">("esewa_sandbox");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={w.withdrawTitle} onClose={onClose}>
      <form className="mt-4 space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (amount < 100) return setErr(errText("payout_min"));
        if (amount > max) return setErr(errText("payout_too_much"));
        setBusy(true); setErr(await onSubmit(amount, method)); setBusy(false);
      }}>
        <label className="block"><span className="field-label">{w.amount}</span>
          <input type="number" min={100} max={max} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="input font-display text-xl font-bold" />
          <span className="field-hint">{w.available}: {rs(max, lang)}</span></label>
        <fieldset><legend className="field-label">{w.to}</legend>
          <div className="flex flex-wrap gap-2">{(["esewa_sandbox", "khalti_sandbox"] as const).map((m) => (
            <label key={m} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 font-semibold ${method === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}>
              <input type="radio" checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--accent)]" /> {t.booking.methods[m]} <span className="demo-tag">{t.common.sandbox}</span>
            </label>))}
          </div></fieldset>
        {err && <p role="alert" className="field-error">{err}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}><ArrowDownToLine size={17} aria-hidden /> {w.withdrawSend}</button>
      </form>
    </Modal>
  );
}

function ApplyDialog({ limit, onClose, onSubmit }: { limit: number; onClose: () => void; onSubmit: (a: number, m: 3 | 6 | 12, p: string) => Promise<string | null> }) {
  const { t, lang } = useI18n();
  const c = t.credit;
  const [amount, setAmount] = useState(Math.min(limit, Math.max(1000, Math.round(limit / 2 / 1000) * 1000)));
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [purpose, setPurpose] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pct = `${Math.round(EXAMPLE_CREDIT_RATE * 100)}%`;
  return (
    <Modal title={c.applyTitle} onClose={onClose}>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted"><span className="demo-tag">{t.common.demo}</span> {c.partner}</p>
      <form className="mt-4 space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        if (purpose.trim().length < 3) return setErr(t.wallet.errors.purpose);
        setBusy(true); setErr(await onSubmit(amount, months, purpose.trim())); setBusy(false);
      }}>
        <div>
          <label htmlFor="cr-amt" className="field-label">{c.amount}: <span className="text-accent">{rs(amount, lang)}</span></label>
          <input id="cr-amt" type="range" min={1000} max={limit} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} aria-valuetext={rs(amount, lang)} className="w-full accent-[var(--accent)]" />
        </div>
        <fieldset><legend className="field-label">{c.months}</legend>
          <div className="flex gap-2">{([3, 6, 12] as const).map((m) => (
            <label key={m} className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[4px] border-[1.5px] font-semibold ${months === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}>
              <input type="radio" checked={months === m} onChange={() => setMonths(m)} className="sr-only" /> {c.monthsN(m)}
            </label>))}
          </div></fieldset>
        <label className="block"><span className="field-label">{c.purpose}</span>
          <input className="input" maxLength={300} value={purpose} placeholder={c.purposePh} onChange={(e) => setPurpose(e.target.value)} /></label>
        <div className="rounded-[4px] bg-surface-2 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{c.monthly}</p>
          <p className="font-display text-2xl font-extrabold">{rs(monthlyInstallment(amount, months), lang)}</p>
          <p className="text-xs text-muted">{c.rateNote(lang === "ne" ? toDeva(pct) : pct)}</p>
        </div>
        {err && <p role="alert" className="field-error">{err}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>{c.submit}</button>
      </form>
    </Modal>
  );
}
