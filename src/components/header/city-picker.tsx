"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, MapPin, Search } from "lucide-react";
import { useCity, useI18n } from "@/components/providers";
import { useDismiss } from "@/components/use-dismiss";
import { ANYWHERE, CITY_COORDS, HEADER_CITIES } from "@/lib/geo";

/** Header button that picks the city used to filter tasks and people. */
export function CityPicker() {
  const { t } = useI18n();
  const { city, setCity } = useCity();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    setQ("");
  }, []);
  const refs = useMemo(() => [btn, pop], []);
  useDismiss(open, close, refs, btn);

  const choose = (c: string) => {
    setCity(c);
    close();
    btn.current?.focus();
  };
  // Typing searches every known city, not only the short list.
  const all = useMemo(
    () => [
      ...new Set<string>([
        ...HEADER_CITIES.filter((c) => c !== "Online"),
        ...Object.keys(CITY_COORDS).sort(),
      ]),
    ],
    [],
  );
  const query = q.trim().toLowerCase();
  const cities = query
    ? all.filter((c) => c.toLowerCase().includes(query))
    : HEADER_CITIES.filter((c) => c !== "Online");
  const showOnline = !query || t.nav.onlineWork.toLowerCase().includes(query) || "online".includes(query);
  const label = city === ANYWHERE ? t.nav.anywhere : city === "Online" ? t.nav.onlineWork : city;

  const row = (value: string, content: React.ReactNode) => (
    <li key={value} role="option" aria-selected={value === city}>
      <button
        type="button"
        onClick={() => choose(value)}
        className={`hover:bg-accent-soft flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-[0.95rem] ${value === city ? "text-accent font-semibold" : ""}`}
      >
        {content}
        {value === city && <Check size={16} aria-hidden className="shrink-0" />}
      </button>
    </li>
  );

  return (
    <div className="relative hidden sm:block">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${t.nav.city}: ${label}`}
        onClick={() => (open ? close() : setOpen(true))}
        className="border-line hover:border-accent inline-flex h-10 items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold"
      >
        {city === ANYWHERE ? (
          <Globe2 size={16} aria-hidden className="text-accent" />
        ) : (
          <MapPin size={16} aria-hidden className="text-accent" />
        )}
        <span className="max-w-32 truncate">{label}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div
          ref={pop}
          className="border-line bg-surface absolute top-12 left-0 z-50 w-72 rounded-md border p-1.5 shadow-[0_12px_40px_-12px_rgba(13,26,20,.35)]"
        >
          <button
            type="button"
            onClick={() => choose(ANYWHERE)}
            className={`flex w-full items-center gap-3 rounded-md p-3 text-left ${city === ANYWHERE ? "bg-accent text-accent-contrast" : "bg-accent-soft hover:brightness-95"}`}
          >
            <Globe2 size={20} aria-hidden className="shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold">{t.nav.anywhere}</span>
              <span className={`block text-xs ${city === ANYWHERE ? "opacity-90" : "text-muted"}`}>
                {t.nav.anywhereNote}
              </span>
            </span>
            {city === ANYWHERE && <Check size={16} aria-hidden />}
          </button>
          <label className="relative mt-1.5 block">
            <span className="sr-only">{t.nav.findCity}</span>
            <Search
              size={15}
              aria-hidden
              className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              type="search"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.nav.findCity}
              maxLength={40}
              onKeyDown={(e) => {
                if (e.key === "Enter" && cities[0]) {
                  e.preventDefault();
                  choose(cities[0]);
                }
              }}
              className="input !min-h-10 !pl-9 !text-[0.95rem]"
            />
          </label>
          <ul role="listbox" aria-label={t.nav.city} className="mt-1 max-h-64 overflow-auto">
            {cities.map((c) => row(c, c))}
            {showOnline &&
              row(
                "Online",
                <span className="inline-flex items-center gap-2">
                  <Globe2 size={15} aria-hidden />
                  {t.nav.onlineWork}
                </span>,
              )}
            {cities.length === 0 && !showOnline && (
              <li className="text-muted px-3 py-3 text-sm">{t.nav.noCity}</li>
            )}
          </ul>
          <Link
            href="/location"
            onClick={close}
            className="border-line text-accent mt-1 flex items-center gap-2 border-t px-3 py-2.5 text-sm font-semibold hover:underline"
          >
            <MapPin size={15} aria-hidden /> {t.location.title}
          </Link>
        </div>
      )}
    </div>
  );
}
