"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { useI18n } from "@/components/providers";
import { splitAdvance } from "@/lib/business";
import { npDate, num, rs } from "@/lib/format";

export type StepState = "done" | "now" | "later" | "cancelled";

/** The three steps of a job's money: what the recruiter pays, what the applicant gets, what Saksham holds. */
export function PlanSteps({
  total,
  dates,
  states,
  children,
}: {
  total: number;
  dates: { start: string; half: string; end: string };
  /** Left out before booking */
  states?: [StepState, StepState, StepState];
  /** What can be done at each step */
  children?: [ReactNode, ReactNode, ReactNode];
}) {
  const { t, lang } = useI18n();
  const m = t.market.money;
  const { firstPayment, secondPayment, payouts, pieces } = splitAdvance(total);
  const steps = [
    {
      key: "start" as const,
      date: dates.start,
      pays: [firstPayment, 50],
      gets: [payouts.advance, 30],
      holds: [pieces.kept, 20],
    },
    {
      key: "half" as const,
      date: dates.half,
      pays: [secondPayment, 50],
      gets: [payouts.half, 30],
      holds: [payouts.finish, 40],
    },
    { key: "finish" as const, date: dates.end, pays: null, gets: [payouts.finish, 40], holds: null },
  ];
  const cell = (label: string, v: number[] | null, none = "—") => (
    <div className="bg-surface p-3">
      <dt className="text-muted text-xs font-semibold">{label}</dt>
      <dd className="font-display text-lg font-extrabold">
        {v ? rs(v[0], lang) : none}
        {v && <span className="text-muted ml-1.5 text-sm">{num(v[1], lang)}%</span>}
      </dd>
    </div>
  );

  return (
    <ol className="space-y-3">
      {steps.map((s, i) => {
        const state = states?.[i];
        const edge =
          state === "done" ? "border-accent" : state === "now" ? "border-marigold" : "border-line-strong";
        return (
          <li
            key={s.key}
            data-step={s.key}
            data-state={state}
            className={`bg-surface rounded-[4px] border border-l-[5px] p-4 sm:p-5 ${edge}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="flex min-w-0 gap-3">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${state === "done" ? "bg-accent text-accent-contrast" : "bg-surface-2"}`}
                >
                  {state === "done" ? <Check size={16} aria-hidden /> : num(i + 1, lang)}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-lg leading-tight font-bold">{m.steps[s.key]}</h3>
                  <p className="text-muted mt-0.5 text-sm">{m.stepWho[s.key]}</p>
                </div>
              </div>
              <p className="text-muted text-xs font-semibold">
                {state ? `${m.stepState[state]} · ` : ""}
                {npDate(s.date, lang, { year: false })}
              </p>
            </div>
            <dl className="border-line bg-line mt-3 grid gap-px overflow-hidden rounded-[4px] border sm:grid-cols-3">
              {cell(m.recruiterPays, s.pays, m.nothingToPay)}
              {cell(m.applicantGets, s.gets)}
              {cell(m.held, s.holds)}
            </dl>
            {children?.[i]}
          </li>
        );
      })}
    </ol>
  );
}
