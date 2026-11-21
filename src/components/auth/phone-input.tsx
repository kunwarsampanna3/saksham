"use client";

import { useId } from "react";

/** Nepal mobile input with a fixed +977 prefix. Value is the bare 10 digits. */
export function PhoneInput({
  value,
  onChange,
  label,
  hint,
  error,
  autoFocus,
  disabled,
  id: idProp,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  hint?: string;
  error?: string | null;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const auto = useId();
  const id = idProp ?? auto;
  const display =
    value.length > 6
      ? `${value.slice(0, 3)} ${value.slice(3, 6)} ${value.slice(6)}`
      : value.length > 3
        ? `${value.slice(0, 3)} ${value.slice(3)}`
        : value;

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="flex items-stretch">
        <span
          className="border-line-strong bg-surface-2 text-muted inline-flex items-center rounded-l-[6px] border-[1.5px] border-r-0 px-3 font-semibold select-none"
          aria-hidden="true"
        >
          +977
        </span>
        <input
          id={id}
          className="input rounded-l-none tracking-wide"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98X XXX XXXX"
          value={display}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => {
            let d = e.target.value.replace(/\D/g, "");
            if (d.startsWith("977") && d.length > 10) d = d.slice(3);
            onChange(d.slice(0, 10));
          }}
        />
      </div>
      {!error && hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export const isNepalMobile = (d: string) => /^9[78]\d{8}$/.test(d);
