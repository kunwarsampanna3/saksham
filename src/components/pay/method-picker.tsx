"use client";

import { CreditCard, Wallet } from "lucide-react";
import { useI18n } from "@/components/providers";
import type { Method } from "./pay-sheet";

const WALLETS_FIRST: Method[] = ["esewa_sandbox", "khalti_sandbox", "card_sandbox"];
const CARD_FIRST: Method[] = ["card_sandbox", "esewa_sandbox", "khalti_sandbox"];

export function MethodPicker({
  legend,
  value,
  onChange,
  cardFirst = false,
  cardHint,
}: {
  legend: string;
  value: Method;
  onChange: (m: Method) => void;
  cardFirst?: boolean;
  cardHint?: string;
}) {
  const { t } = useI18n();
  const b = t.booking;
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {(cardFirst ? CARD_FIRST : WALLETS_FIRST).map((m) => (
          <label
            key={m}
            className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 text-sm font-semibold ${value === m ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}
          >
            <input
              type="radio"
              checked={value === m}
              onChange={() => onChange(m)}
              className="accent-[var(--accent)]"
            />
            {m === "card_sandbox" ? <CreditCard size={17} aria-hidden /> : <Wallet size={17} aria-hidden />}
            {b.methods[m]} <span className="demo-tag">{t.common.sandbox}</span>
            {m === "card_sandbox" && cardHint && <span className="text-xs">· {cardHint}</span>}
          </label>
        ))}
      </div>
      <p className="text-muted mt-2 text-xs">{b.sandboxNote}</p>
    </fieldset>
  );
}
