"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useI18n } from "@/components/providers";

export interface MpinHandle { focus: () => void; clear: () => void }

/**
 * Four masked boxes. Supports typing, paste of all four digits, arrow keys and backspace.
 * Each box is labelled for screen readers ("MPIN digit 2 of 4"); the group carries the error.
 */
export const MpinInput = forwardRef<MpinHandle, {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  label: string;
  hint?: string;
  error?: string | null;
  shakeKey?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  allowReveal?: boolean;
}>(function MpinInput({ value, onChange, onComplete, label, hint, error, shakeKey = 0, autoFocus, disabled, allowReveal = true }, ref) {
  const { t } = useI18n();
  const id = useId();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const [reveal, setReveal] = useState(false);
  const [shaking, setShaking] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => boxes.current[Math.min(value.length, 3)]?.focus(),
    clear: () => { onChange(""); boxes.current[0]?.focus(); },
  }), [value, onChange]);

  useEffect(() => {
    if (!shakeKey) return;
    setShaking(true);
    const tm = setTimeout(() => setShaking(false), 520);
    return () => clearTimeout(tm);
  }, [shakeKey]);

  const handleInput = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    if (digits.length > 1) {
      // paste or autofill into one box
      const merged = (value.slice(0, i) + digits).slice(0, 4);
      onChange(merged);
      boxes.current[Math.min(merged.length, 3)]?.focus();
      if (merged.length === 4) onComplete?.(merged);
      return;
    }
    const next = (value.slice(0, i) + digits + value.slice(i + 1)).slice(0, 4);
    onChange(next);
    if (i < 3) boxes.current[i + 1]?.focus();
    if (next.length === 4) onComplete?.(next);
  };

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      // Digits are always contiguous, so removing one keeps the rest in order.
      if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) { onChange(value.slice(0, i - 1)); boxes.current[i - 1]?.focus(); }
    } else if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); boxes.current[i - 1]?.focus(); }
    else if (e.key === "ArrowRight" && i < 3) { e.preventDefault(); boxes.current[i + 1]?.focus(); }
  };

  return (
    <fieldset className="min-w-0" aria-describedby={`${id}-hint ${error ? `${id}-err` : ""}`}>
      <div className="mb-2 flex items-center justify-between">
        <legend className="field-label mb-0">{label}</legend>
        {allowReveal && (
          <button type="button" className="btn-quiet btn min-h-8 px-1 text-sm" onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
            {reveal ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {reveal ? t.login.hideMpin : t.login.showMpin}
          </button>
        )}
      </div>
      <div className={`pin-group flex gap-2.5 sm:gap-3 ${shaking ? "shake" : ""}`} aria-invalid={error ? true : undefined}>
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={(el) => { boxes.current[i] = el; }}
            className="pin-box"
            style={reveal ? { WebkitTextSecurity: "none" } as React.CSSProperties : undefined}
            type={reveal ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={i === 0 ? 4 : 1}
            aria-label={`${label} ${i + 1} / 4`}
            value={value[i] ?? ""}
            data-filled={value[i] ? "true" : "false"}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onFocus={(e) => e.target.select()}
            onPaste={(e) => { e.preventDefault(); handleInput(i, e.clipboardData.getData("text")); }}
          />
        ))}
      </div>
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="field-error">{error}</p>}
    </fieldset>
  );
});
