"use client";

import { Users } from "lucide-react";
import { useI18n } from "@/components/providers";
import { rs, rsRange } from "@/lib/format";
import type { fairRange } from "@/lib/pricing";
import type { UpdateFields, WizardFields } from "./wizard-state";

export type FairRange = ReturnType<typeof fairRange>;

/** Slider bounds: half of the fair low to one and a half times the fair high, in steps of Rs. 100. */
export function sliderBounds(range: FairRange | null) {
  return {
    min: range ? Math.max(100, Math.round((range.low * 0.5) / 100) * 100) : 100,
    max: range ? Math.round((range.high * 1.5) / 100) * 100 : 10000,
  };
}

/** Step 3: see the fair price range, set an optional budget, choose women-only. */
export function StepPrice({
  form,
  update,
  range,
}: {
  form: WizardFields;
  update: UpdateFields;
  range: FairRange | null;
}) {
  const { t, lang } = useI18n();
  const p = t.post;
  const { budget, womenOnly } = form;
  const { min: sliderMin, max: sliderMax } = sliderBounds(range);
  const budgetState =
    budget === null || !range ? null : budget < range.low ? "low" : budget > range.high ? "high" : "ok";

  return (
    <div className="mt-5 space-y-6">
      {range && (
        <div className="bg-surface-2 rounded-[4px] p-4">
          <p className="text-muted text-xs font-semibold tracking-wider uppercase">{p.fairRange}</p>
          <p className="font-display text-accent text-3xl font-extrabold">
            {rsRange(range.low, range.high, lang)}
          </p>
          <p className="text-muted text-sm">{p.fairFrom}</p>
          <ul className="text-muted mt-2 list-disc pl-5 text-sm">
            {range.basis.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
      <fieldset>
        <legend className="field-label">{p.budgetTitle}</legend>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={budget === null}
            onChange={(e) => update({ budget: e.target.checked ? null : (range?.mid ?? 1000) })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          {p.noBudget}
        </label>
        {budget !== null && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="w-budget" className="font-semibold">
                {p.yourBudget}
              </label>
              <input
                type="number"
                min={100}
                step={100}
                inputMode="numeric"
                value={budget}
                aria-label={p.yourBudget}
                onChange={(e) => update({ budget: Math.max(0, Number(e.target.value) || 0) })}
                className="input font-display !min-h-10 w-36 text-right text-lg font-bold"
              />
            </div>
            <input
              id="w-budget"
              type="range"
              min={sliderMin}
              max={sliderMax}
              step={100}
              value={Math.min(Math.max(budget, sliderMin), sliderMax)}
              onChange={(e) => update({ budget: Number(e.target.value) })}
              aria-valuetext={rs(budget, lang)}
              className="mt-3 w-full accent-[var(--accent)]"
            />
            {/* Green band under the slider marks the fair range */}
            {range && (
              <div className="bg-line relative mt-1 h-2 rounded" aria-hidden>
                <div
                  className="bg-leaf absolute inset-y-0 rounded"
                  style={{
                    left: `${((range.low - sliderMin) / (sliderMax - sliderMin)) * 100}%`,
                    width: `${((range.high - range.low) / (sliderMax - sliderMin)) * 100}%`,
                  }}
                />
              </div>
            )}
            {budgetState && (
              <p
                className={`mt-2 text-sm font-semibold ${budgetState === "ok" ? "text-accent" : budgetState === "low" ? "text-danger" : "text-muted"}`}
              >
                {budgetState === "ok" ? p.budgetOk : budgetState === "low" ? p.budgetLow : p.budgetHigh}
              </p>
            )}
          </div>
        )}
      </fieldset>
      <label className="border-line flex cursor-pointer items-start gap-2.5 rounded-[4px] border p-4">
        <input
          type="checkbox"
          checked={womenOnly}
          onChange={(e) => update({ womenOnly: e.target.checked })}
          className="mt-1 h-4 w-4 accent-[var(--accent)]"
        />
        <span>
          <span className="flex items-center gap-1.5 font-semibold">
            <Users size={16} aria-hidden className="text-accent" /> {p.womenOnly}
          </span>
          <span className="text-muted text-sm">{p.womenOnlyNote}</span>
        </span>
      </label>
    </div>
  );
}
