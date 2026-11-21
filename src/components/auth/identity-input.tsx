"use client";

import { useId } from "react";
import { Mail, Smartphone } from "lucide-react";
import { useI18n } from "@/components/providers";
import { PhoneInput } from "./phone-input";

export type Channel = "phone" | "email";

export const isEmailAddress = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Mobile number | Email switch with the matching field. Used by sign-in, sign-up and forgot MPIN. */
export function IdentityInput({
  channel,
  onChannel,
  phone,
  onPhone,
  email,
  onEmail,
  error,
  autoFocus,
}: {
  channel: Channel;
  onChannel: (c: Channel) => void;
  phone: string;
  onPhone: (v: string) => void;
  email: string;
  onEmail: (v: string) => void;
  error?: string | null;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const tab = (c: Channel, label: string, Icon: typeof Mail) => (
    <button
      type="button"
      role="radio"
      aria-checked={channel === c}
      onClick={() => onChannel(c)}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-[6px] px-3 py-2 text-[0.95rem] font-semibold transition-colors ${channel === c ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-text"}`}
    >
      <Icon size={17} aria-hidden /> {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label={t.login.channelLabel}
        className="bg-surface-2 flex gap-1 rounded-[8px] p-1"
      >
        {tab("phone", t.login.channelPhone, Smartphone)}
        {tab("email", t.login.channelEmail, Mail)}
      </div>

      {channel === "phone" ? (
        <PhoneInput
          value={phone}
          onChange={onPhone}
          label={t.login.phone}
          hint={t.login.phoneHint}
          error={error}
          autoFocus={autoFocus}
        />
      ) : (
        <div>
          <label htmlFor={`${id}-email`} className="field-label">
            {t.login.email}
          </label>
          <input
            id={`${id}-email`}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className="input"
            maxLength={254}
            placeholder="name@gmail.com"
            value={email}
            autoFocus={autoFocus}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-email-h`}
            onChange={(e) => onEmail(e.target.value)}
          />
          {error ? (
            <p id={`${id}-email-h`} role="alert" className="field-error">
              {error}
            </p>
          ) : (
            <p id={`${id}-email-h`} className="field-hint">
              {t.login.emailHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Request body for the chosen channel. */
export const targetBody = (channel: Channel, phone: string, email: string) =>
  channel === "email" ? { email: email.trim().toLowerCase() } : { phone };
