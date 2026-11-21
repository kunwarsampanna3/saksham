"use client";

import { Moon, Sun, MonitorSmartphone } from "lucide-react";
import { useI18n, useTheme } from "@/components/providers";

/** नेपाली / English segmented switch. */
export function LangSwitch({ tone = "default" }: { tone?: "default" | "onDark" }) {
  const { lang, setLang, t } = useI18n();
  const base = tone === "onDark" ? "border-white/30 text-white" : "border-line-strong text-text";
  return (
    <div
      role="group"
      aria-label={t.lang.label}
      className={`inline-flex overflow-hidden rounded-md border ${base}`}
    >
      {(["ne", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => lang !== l && setLang(l)}
          className={`min-h-9 px-2.5 text-sm font-semibold transition-colors ${
            lang === l
              ? tone === "onDark"
                ? "text-forest bg-white"
                : "bg-accent text-accent-contrast"
              : "hover:bg-accent-soft"
          } ${l === "ne" ? "deva" : ""}`}
        >
          {l === "ne" ? "नेपाली" : "English"}
        </button>
      ))}
    </div>
  );
}

/** Cycles light → dark → system. */
export function ThemeToggle({ tone = "default" }: { tone?: "default" | "onDark" }) {
  const { pref, setPref } = useTheme();
  const { t } = useI18n();
  const next = pref === "light" ? "dark" : pref === "dark" ? "system" : "light";
  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : MonitorSmartphone;
  const label = `${t.theme.label}: ${t.theme[pref]}`;
  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
        tone === "onDark"
          ? "border-white/30 text-white hover:bg-white/10"
          : "border-line-strong text-text hover:border-accent hover:text-accent"
      }`}
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
