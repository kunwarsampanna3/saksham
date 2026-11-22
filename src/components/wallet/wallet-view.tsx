"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, BadgeCheck, Star, FileText, Info, FlaskConical, Check, X } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { useReauth } from "@/components/reauth-dialog";
import { rs, npDate, num } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";
import { CATEGORIES } from "@/lib/pricing";
import { monthlyInstallment, EXAMPLE_CREDIT_RATE, CREDIT_RULES } from "@/lib/rules";
import { MIN_WITHDRAW, withdrawalFee } from "@/lib/business";
import { CreditPanel, type CreditData, type CreditKind } from "./credit-panel";

interface Passport {
  completedJobs: number;
  verifiedEarnings: number;
  rating: number;
  ratingCount: number;
  categories: string[];
  since: string;
  verified: boolean;
  isExample: boolean;
}
export interface WalletData extends CreditData {
  provider: {
    releasedGross: number;
    fees: number;
    earnedNet: number;
    inEscrow: number;
    scheduled: number;
    received: number;
    available: number;
    untaxed: number;
    taxedBefore: number;
  };
  client: { paidIn: number; inEscrow: number; released: number; refunded: number };
  receipts: {
    id: string;
    bookingId: string;
    taskTitle: string;
    kind: "hold" | "release" | "refund";
    amount: number;
    fee: number;
    receiptNo: string;
    createdAt: string;
    role: "client" | "provider";
  }[];
  payouts: {
    id: string;
    amount: number;
    fee: number;
    method: "esewa_sandbox" | "khalti_sandbox" | "card_sandbox";
    ref: string;
    createdAt: string;
  }[];
  passport: Passport;
  examplePassport: Passport | null;
}

export function WalletView({
  data,
  isProvider,
  isRecruiter,
  working,
  qrSvg,
  passportUrl,
}: {
  data: WalletData;
  isProvider: boolean;
  isRecruiter: boolean;
  working: boolean;
  qrSvg: string;
  passportUrl: string;
}) {
  const { t, lang } = useI18n();
  const w = t.wallet;
  const router = useRouter();
  const { ensureFresh, dialog } = useReauth();
  const [tab, setTab] = useState<"provider" | "client">(isProvider ? "provider" : "client");
  const [useExample, setUseExample] = useState(
    !!data.examplePassport && data.passport.completedJobs < CREDIT_RULES.minJobs,
  );
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [applying, setApplying] = useState<{ kind: CreditKind; left: number; example: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const passport = useExample && data.examplePassport ? data.examplePassport : data.passport;

  const errText = (e?: string) =>
    e && e in w.errors
      ? w.errors[e as keyof typeof w.errors]
      : e === "offline"
        ? t.errors.offline
        : t.errors.generic;

  /** money actions: MPIN first, retry once if the server says the MPIN is stale */
  const moneyPost = async (body: Record<string, unknown>) => {
    if (!(await ensureFresh()))
      return { ok: false, error: "cancelled" } as { ok: boolean; error?: string; ref?: string };
    let r = await postJson<{ ref?: string }>("/api/wallet", body);
    if (!r.ok && r.error === "reauth_required" && (await ensureFresh()))
      r = await postJson<{ ref?: string }>("/api/wallet", body);
    return r;
  };

  const Stat = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <div className="bg-surface p-4">
      <dt className="text-muted text-xs font-semibold tracking-wider uppercase">{label}</dt>
      <dd className={`font-display mt-1 font-extrabold ${strong ? "text-accent text-3xl" : "text-xl"}`}>
        {rs(value, lang)}
      </dd>
    </div>
  );

  return (
    <div className="space-y-12">
      <p className="text-muted flex items-start gap-2 text-sm">
        <span className="demo-tag shrink-0">{t.common.sandbox}</span> {w.sandbox}
      </p>
      {notice && (
        <p
          role="status"
          className="bg-accent-soft text-accent flex items-center gap-2 rounded-[4px] p-3 font-semibold"
        >
          <Check size={17} aria-hidden /> {notice}
        </p>
      )}

      {/* balances */}
      <section aria-labelledby="bal-h">
        <h2 id="bal-h" className="sr-only">
          {w.title}
        </h2>
        <div
          role="tablist"
          aria-label={w.title}
          className="border-line-strong bg-surface inline-flex rounded-[5px] border p-1"
        >
          {(["provider", "client"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              type="button"
              onClick={() => setTab(k)}
              className={`min-h-10 rounded-[4px] px-4 font-semibold ${tab === k ? "bg-accent text-accent-contrast" : "hover:text-accent"}`}
            >
              {w.tabs[k]}
            </button>
          ))}
        </div>
        {tab === "provider" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="notch-frame lg:col-span-4">
              <div className="notch-card terrace-edge flex h-full flex-col justify-between p-5">
                <div>
                  <p className="text-muted text-xs font-semibold tracking-wider uppercase">{w.available}</p>
                  <p className="font-display text-accent text-4xl font-extrabold">
                    {rs(data.provider.available, lang)}
                  </p>
                  <p className="text-muted text-sm">{t.market.withdraw.beforeFee}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary mt-4"
                  disabled={data.provider.available < 100 || !isProvider}
                  onClick={() => setWithdrawOpen(true)}
                >
                  <ArrowDownToLine size={17} aria-hidden /> {w.withdraw}
                </button>
              </div>
            </div>
            <dl className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border lg:col-span-8 lg:grid-cols-3">
              <Stat label={w.inEscrow} value={data.provider.inEscrow} />
              <Stat label={w.scheduled} value={data.provider.scheduled} />
              <Stat label={w.releasedGross} value={data.provider.releasedGross} />
              <Stat label={w.fees} value={data.provider.fees} />
              <Stat label={w.earned} value={data.provider.earnedNet} />
              <Stat label={w.paidOut} value={data.provider.received} />
            </dl>
          </div>
        ) : (
          <dl className="border-line bg-line mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border lg:grid-cols-4">
            <Stat label={w.paidIn} value={data.client.paidIn} strong />
            <Stat label={w.clientEscrow} value={data.client.inEscrow} />
            <Stat label={w.released} value={data.client.released} />
            <Stat label={w.refunded} value={data.client.refunded} />
          </dl>
        )}
      </section>

      {/* Passport + Credit */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section
          id="passport"
          aria-labelledby="pp-h"
          className="bg-forest relative overflow-hidden rounded-[4px] p-6 text-[#d9e8dd]"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="pp-h" className="font-display text-2xl font-bold text-white">
                {t.passport.title}
              </h2>
              <p className="mt-1 max-w-md text-sm">{t.passport.lead}</p>
            </div>
            {passport.isExample && (
              <span className="demo-tag !border-white/40 !bg-white/10 !text-white">{t.passport.example}</span>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <div
              className="h-28 w-28 shrink-0 rounded-[4px] bg-white p-1.5"
              role="img"
              aria-label={`${t.passport.scan}: ${passportUrl}`}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <dl className="grid flex-1 grid-cols-2 gap-3">
              <div>
                <dt className="text-leaf text-xs tracking-wider uppercase">{t.passport.jobs}</dt>
                <dd className="font-display text-2xl font-extrabold text-white">
                  {num(passport.completedJobs, lang)}
                </dd>
              </div>
              <div>
                <dt className="text-leaf text-xs tracking-wider uppercase">{t.passport.earnings}</dt>
                <dd className="font-display text-2xl font-extrabold text-white">
                  {rs(passport.verifiedEarnings, lang)}
                </dd>
              </div>
              <div>
                <dt className="text-leaf text-xs tracking-wider uppercase">{t.passport.rating}</dt>
                <dd className="font-display flex items-center gap-1 text-2xl font-extrabold text-white">
                  <Star size={18} aria-hidden className="fill-marigold text-marigold" />
                  {passport.ratingCount
                    ? lang === "ne"
                      ? toDeva(passport.rating.toFixed(1))
                      : passport.rating.toFixed(1)
                    : "—"}
                  <span className="text-xs font-normal text-[#b7cdbd]">
                    {t.passport.ratingCount(passport.ratingCount)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-leaf text-xs tracking-wider uppercase">
                  {passport.verified ? t.passport.verified : t.passport.notVerified}
                </dt>
                <dd className="mt-1 text-sm">
                  {passport.verified ? (
                    <BadgeCheck size={22} aria-hidden className="text-leaf" />
                  ) : (
                    <Link href="/verification" className="underline">
                      {t.nav.verification}
                    </Link>
                  )}
                </dd>
              </div>
            </dl>
          </div>
          {passport.categories.length > 0 && (
            <p className="mt-3 text-sm">
              {passport.categories
                .map((c) => {
                  const x = CATEGORIES.find((k) => k.id === c);
                  return x ? (lang === "ne" ? x.ne : x.en) : c;
                })
                .join(" · ")}
            </p>
          )}
          <p className="mt-2 text-xs text-[#b7cdbd]">
            {t.passport.since(npDate(passport.since, lang, { year: true }))}
          </p>
          {passport.isExample && <p className="mt-3 text-xs text-[#f6d27a]">{t.passport.exampleNote}</p>}
          {!passport.isExample && passport.completedJobs === 0 && (
            <p className="mt-3 text-sm">{t.passport.none}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={passportUrl.replace(/^https?:\/\/[^/]+/, "")}
              className="btn btn-ghost !min-h-10 !border-white/40 !text-white"
            >
              {t.passport.share}
            </Link>
            {data.examplePassport && (
              <button
                type="button"
                className="btn btn-quiet !text-leaf !min-h-10"
                onClick={() => setUseExample((v) => !v)}
              >
                <FlaskConical size={15} aria-hidden />{" "}
                {useExample ? t.passport.showReal : t.passport.showExample}
              </button>
            )}
          </div>
        </section>

        <CreditPanel
          data={data}
          hasRole={{ applicant: isProvider, recruiter: isRecruiter }}
          initial={working ? "applicant" : "recruiter"}
          onApply={(kind, left, example) => setApplying({ kind, left, example })}
        />
      </div>

      {/* receipts + payouts */}
      <div className="grid gap-8 lg:grid-cols-12">
        <section aria-labelledby="rc-h" className="lg:col-span-8">
          <h2 id="rc-h" className="font-display text-xl font-bold">
            {w.receipts}
          </h2>
          {data.receipts.length === 0 ? (
            <p className="text-muted mt-2">{w.noReceipts}</p>
          ) : (
            <ul className="divide-line border-line mt-3 divide-y border-y">
              {data.receipts.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {t.payments.receiptKinds[r.kind]} — {r.taskTitle}
                    </span>
                    <span className="text-muted block text-sm">
                      {r.receiptNo} · {npDate(r.createdAt, lang)} ·{" "}
                      {r.role === "client" ? w.asClient : w.asProvider}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-display font-bold">{rs(r.amount, lang)}</span>
                    <Link
                      href={`/payments/${r.bookingId}/receipt/${r.id}`}
                      className="btn btn-quiet !min-h-9 text-sm"
                    >
                      <FileText size={15} aria-hidden /> {t.payments.viewReceipt}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-6 lg:col-span-4">
          <section aria-labelledby="po-h">
            <h2 id="po-h" className="font-display text-xl font-bold">
              {w.payouts}
            </h2>
            {data.payouts.length === 0 ? (
              <p className="text-muted mt-2">{w.noPayouts}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {data.payouts.map((p) => (
                  <li key={p.id} className="border-line rounded-[4px] border p-3">
                    <span className="flex justify-between font-semibold">
                      <span>{t.booking.methods[p.method]}</span>
                      <span>{rs(p.amount - p.fee, lang)}</span>
                    </span>
                    {p.fee > 0 && (
                      <span className="text-muted block text-xs">
                        {t.market.withdraw.feeOf(rs(p.fee, lang))}
                      </span>
                    )}
                    <span className="text-muted block text-xs">
                      {p.ref} · {npDate(p.createdAt, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section id="fees" aria-labelledby="fees-h" className="bg-surface-2 rounded-[4px] p-4">
            <h2 id="fees-h" className="font-display flex items-center gap-2 text-lg font-bold">
              <Info size={17} aria-hidden className="text-accent" /> {w.feesTitle}
            </h2>
            <p className="text-muted mt-1 text-sm">{w.feesBody}</p>
          </section>
        </aside>
      </div>

      {dialog}
      {withdrawOpen && (
        <WithdrawDialog
          max={data.provider.available}
          taxed={data.provider}
          onClose={() => setWithdrawOpen(false)}
          errText={errText}
          onSubmit={async (amount, method) => {
            const r = await moneyPost({ action: "payout", amount, method });
            if (r.ok) {
              setWithdrawOpen(false);
              setNotice(w.withdrawn(r.ref ?? ""));
              router.refresh();
              return null;
            }
            return r.error === "cancelled" ? null : errText(r.error);
          }}
        />
      )}
      {applying && (
        <ApplyDialog
          limit={applying.left}
          onClose={() => setApplying(null)}
          onSubmit={async (amount, months, purpose) => {
            const { kind, example } = applying;
            const r = await moneyPost({ action: "credit", kind, amount, months, purpose, example });
            if (r.ok) {
              setApplying(null);
              setNotice(t.credit.submitted);
              router.refresh();
              return null;
            }
            return r.error === "cancelled" ? null : errText(r.error);
          }}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
      className="border-line bg-surface text-text backdrop:bg-ink/60 m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border p-0"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-accent-soft inline-flex h-9 w-9 items-center justify-center rounded-md"
            aria-label="Close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function WithdrawDialog({
  max,
  taxed,
  onClose,
  onSubmit,
  errText,
}: {
  max: number;
  taxed: { untaxed: number; taxedBefore: number };
  onClose: () => void;
  onSubmit: (a: number, m: "esewa_sandbox" | "khalti_sandbox") => Promise<string | null>;
  errText: (e?: string) => string;
}) {
  const { t, lang } = useI18n();
  const w = t.wallet;
  const [amount, setAmount] = useState(max);
  const [method, setMethod] = useState<"esewa_sandbox" | "khalti_sandbox">("esewa_sandbox");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const x = t.market.withdraw;
  const { fee } = withdrawalFee(amount, taxed);
  return (
    <Modal title={w.withdrawTitle} onClose={onClose}>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (amount < MIN_WITHDRAW) return setErr(errText("payout_min"));
          if (amount > max) return setErr(errText("payout_too_much"));
          setBusy(true);
          setErr(await onSubmit(amount, method));
          setBusy(false);
        }}
      >
        <label className="block">
          <span className="field-label">{w.amount}</span>
          <input
            type="number"
            min={100}
            max={max}
            value={amount}
            onChange={(e) => setAmount(Math.floor(Number(e.target.value)) || 0)}
            className="input font-display text-xl font-bold"
          />
          <span className="field-hint">
            {w.available}: {rs(max, lang)}
          </span>
        </label>
        <dl className="bg-surface-2 rounded-[4px] p-3 text-sm" aria-live="polite" data-withdraw-sum>
          <div className="flex justify-between gap-3">
            <dt>{x.fee}</dt>
            <dd className="font-semibold">− {rs(fee, lang)}</dd>
          </div>
          <div className="mt-1 flex justify-between gap-3 font-semibold">
            <dt>{x.receive}</dt>
            <dd className="font-display text-xl font-extrabold">{rs(Math.max(0, amount - fee), lang)}</dd>
          </div>
          {taxed.untaxed > 0 && <p className="text-muted mt-1.5 text-xs">{x.lowered}</p>}
        </dl>
        <fieldset>
          <legend className="field-label">{w.to}</legend>
          <div className="flex flex-wrap gap-2">
            {(["esewa_sandbox", "khalti_sandbox"] as const).map((m) => (
              <label
                key={m}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 font-semibold ${method === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}
              >
                <input
                  type="radio"
                  checked={method === m}
                  onChange={() => setMethod(m)}
                  className="accent-[var(--accent)]"
                />{" "}
                {t.booking.methods[m]} <span className="demo-tag">{t.common.sandbox}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          <ArrowDownToLine size={17} aria-hidden /> {w.withdrawSend}
        </button>
      </form>
    </Modal>
  );
}

function ApplyDialog({
  limit,
  onClose,
  onSubmit,
}: {
  limit: number;
  onClose: () => void;
  onSubmit: (a: number, m: 3 | 6 | 12, p: string) => Promise<string | null>;
}) {
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
      <p className="text-muted mt-1 flex items-center gap-2 text-sm">
        <span className="demo-tag">{t.common.demo}</span> {c.partner}
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (purpose.trim().length < 3) return setErr(t.wallet.errors.purpose);
          setBusy(true);
          setErr(await onSubmit(amount, months, purpose.trim()));
          setBusy(false);
        }}
      >
        <div>
          <label htmlFor="cr-amt" className="field-label">
            {c.amount}: <span className="text-accent">{rs(amount, lang)}</span>
          </label>
          <input
            id="cr-amt"
            type="range"
            min={1000}
            max={limit}
            step={1000}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            aria-valuetext={rs(amount, lang)}
            className="w-full accent-[var(--accent)]"
          />
        </div>
        <fieldset>
          <legend className="field-label">{c.months}</legend>
          <div className="flex gap-2">
            {([3, 6, 12] as const).map((m) => (
              <label
                key={m}
                className={`inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[4px] border-[1.5px] font-semibold ${months === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}
              >
                <input
                  type="radio"
                  checked={months === m}
                  onChange={() => setMonths(m)}
                  className="sr-only"
                />{" "}
                {c.monthsN(m)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="field-label">{c.purpose}</span>
          <input
            className="input"
            maxLength={300}
            value={purpose}
            placeholder={c.purposePh}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </label>
        <div className="bg-surface-2 rounded-[4px] p-3">
          <p className="text-muted text-xs font-semibold tracking-wider uppercase">{c.monthly}</p>
          <p className="font-display text-2xl font-extrabold">
            {rs(monthlyInstallment(amount, months), lang)}
          </p>
          <p className="text-muted text-xs">{c.rateNote(lang === "ne" ? toDeva(pct) : pct)}</p>
        </div>
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {c.submit}
        </button>
      </form>
    </Modal>
  );
}
