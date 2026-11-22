"use client";

import { useState } from "react";
import { BriefcaseBusiness, Check, FlaskConical, Hammer, Landmark, Lock } from "lucide-react";
import { useI18n } from "@/components/providers";
import { CREDIT_RULES, type CreditOffer } from "@/lib/rules";
import { npDate, num, rs } from "@/lib/format";

export type CreditKind = CreditOffer["kind"];
export interface CreditState extends CreditOffer {
  used: number;
  left: number;
}
export interface CreditData {
  credit: Record<CreditKind, CreditState>;
  exampleCredit: Record<CreditKind, CreditState | null>;
  applications: {
    id: string;
    kind: CreditKind;
    amount: number;
    months: number;
    status: "submitted_demo" | "approved_demo" | "declined_demo";
    createdAt: string;
  }[];
}

/** Saksham Credit: what it takes, how far along you are, and what you can apply for. */
export function CreditPanel({
  data,
  hasRole,
  initial,
  onApply,
}: {
  data: CreditData;
  hasRole: Record<CreditKind, boolean>;
  initial: CreditKind;
  onApply: (kind: CreditKind, left: number, example: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const c = t.credit;
  const m = t.market.credit;
  const [kind, setKind] = useState<CreditKind>(initial);
  const [showExample, setShowExample] = useState(true);

  const example = data.exampleCredit[kind];
  const usingExample = showExample && !!example && !data.credit[kind].eligible;
  const x = usingExample ? example : data.credit[kind];
  const met = x.remaining === 0;
  const pct = Math.min(100, Math.round((x.count / x.need) * 100));
  const applications = data.applications.filter((a) => a.kind === kind);
  const Icon = kind === "applicant" ? Hammer : BriefcaseBusiness;

  return (
    <section id="credit" aria-labelledby="cr-h" className="notch-frame" data-credit={kind}>
      <div className="notch-card terrace-edge h-full p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="cr-h" className="font-display text-2xl font-bold">
            {c.title}
          </h2>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
            <Landmark size={16} aria-hidden /> {c.partner} <span className="demo-tag">{t.common.demo}</span>
          </span>
        </div>

        <div
          role="tablist"
          aria-label={c.title}
          className="border-line-strong bg-surface-2 mt-4 grid grid-cols-2 rounded-[5px] border p-1"
        >
          {(["applicant", "recruiter"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-10 rounded-[4px] px-2 text-sm font-semibold ${kind === k ? "bg-accent text-accent-contrast" : "hover:text-accent"}`}
            >
              {m.tabs[k]}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[0.95rem]">{m.what[kind]}</p>
        {usingExample && (
          <p className="demo-tag mt-2">
            <FlaskConical size={11} aria-hidden /> {m.example}
          </p>
        )}

        {/* the requirement */}
        <div className={`mt-3 rounded-[10px] p-4 ${met ? "bg-accent-soft" : "bg-surface-2"}`}>
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${met ? "bg-accent text-accent-contrast" : "bg-surface"}`}
            >
              {met ? <Check size={20} aria-hidden /> : <Icon size={19} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{m.requirement[kind](num(x.need, lang))}</p>
              <p className="text-muted text-sm">
                {met ? m.unlocked : m.remaining[kind](num(x.remaining, lang))}
              </p>
            </div>
            <p className="font-display text-lg font-extrabold whitespace-nowrap" data-credit-progress>
              {m.progress(num(x.count, lang), num(x.need, lang))}
            </p>
          </div>
          <div
            className="bg-line mt-3 h-2.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-label={m.requirement[kind](num(x.need, lang))}
            aria-valuemin={0}
            aria-valuemax={x.need}
            aria-valuenow={Math.min(x.count, x.need)}
          >
            <div className="bg-accent h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* the money */}
        <p className="text-muted mt-5 text-xs font-semibold tracking-wider uppercase">{c.limit}</p>
        <p
          className="font-display text-accent flex items-center gap-2 text-4xl font-extrabold"
          data-credit-limit
        >
          {x.eligible ? (
            rs(x.limit, lang)
          ) : (
            <>
              <Lock size={26} aria-hidden /> {c.notYet}
            </>
          )}
        </p>
        <dl className="divide-line border-line mt-3 divide-y border-y text-sm">
          {[
            [m.basis[kind], x.money],
            [m.share, x.base],
            ...(x.eligible
              ? [
                  [m.used, x.used],
                  [m.left, x.left],
                ]
              : []),
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between gap-3 py-2">
              <dt className="text-muted">{label as string}</dt>
              <dd className="font-semibold">{rs(value as number, lang)}</dd>
            </div>
          ))}
        </dl>
        {met && !x.eligible && <p className="mt-2 text-sm">{m.noMoney[kind]}</p>}
        {x.halved && x.eligible && <p className="mt-2 text-sm">{c.halved}</p>}
        {x.capped && x.limit === CREDIT_RULES.cap && <p className="mt-2 text-sm">{c.capped}</p>}

        <details className="bg-surface-2 mt-4 rounded-[4px] p-3 text-sm">
          <summary className="cursor-pointer font-semibold">{c.howTitle}</summary>
          <ul className="text-muted mt-2 list-disc space-y-1 pl-5">
            {c.rules[kind].map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!x.eligible || !hasRole[kind] || x.left < 1000}
            onClick={() => onApply(kind, x.left, usingExample)}
          >
            {c.apply}
          </button>
          {example && !data.credit[kind].eligible && (
            <button type="button" className="btn btn-quiet" onClick={() => setShowExample((v) => !v)}>
              <FlaskConical size={15} aria-hidden />{" "}
              {usingExample ? t.passport.showReal : t.passport.showExample}
            </button>
          )}
        </div>
        {!hasRole[kind] && <p className="text-muted mt-2 text-sm">{m.addRole[kind]}</p>}
        <p className="text-muted mt-3 text-xs">
          {c.lead} {c.simple.partnerNote}
        </p>

        {applications.length > 0 && (
          <div className="border-line mt-5 border-t pt-3">
            <p className="text-muted text-xs font-semibold tracking-wider uppercase">{c.applications}</p>
            <ul className="mt-1 space-y-1 text-sm">
              {applications.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-x-2">
                  <span>
                    {rs(a.amount, lang)} · {c.monthsN(a.months)}
                  </span>
                  <span className={a.status === "approved_demo" ? "text-accent font-semibold" : "text-muted"}>
                    {m.status[a.status]} · {npDate(a.createdAt, lang)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
