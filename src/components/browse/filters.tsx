"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/components/providers";
import { CATEGORIES } from "@/lib/pricing";
import { ANYWHERE, HEADER_CITIES } from "@/lib/geo";
import { RADII, PRICE_CAPS, type Filters } from "@/lib/search";
import { num } from "@/lib/format";

/**
 * Filter bar. A plain GET form (works without JS); with JS every change updates the URL
 * in place, so results re-render on the server without a full reload.
 */
export function FilterBar({ f, showView = true, canSeeWomenOnly, compact = false }: { f: Filters; showView?: boolean; canSeeWomenOnly: boolean; compact?: boolean }) {
  const { t, lang } = useI18n();
  const e = t.explore;
  const router = useRouter();
  const path = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  const push = () => {
    if (!form.current) return;
    const data = new FormData(form.current);
    const p = new URLSearchParams();
    for (const [k, v] of data.entries()) if (typeof v === "string" && v && !(k === "sort" && v === "best")) p.set(k, v);
    start(() => router.replace(`${path}${p.toString() ? `?${p}` : ""}`, { scroll: false }));
  };

  const sel = "input !min-h-11 appearance-none !pr-8 text-[0.95rem]";
  const Check = ({ name, label, on }: { name: string; label: string; on: boolean }) => (
    <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 text-[0.95rem] font-semibold ${on ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}>
      <input type="checkbox" name={name} value="1" defaultChecked={on} onChange={push} className="h-4 w-4 accent-[var(--accent)]" />
      {label}
    </label>
  );

  const fields = (
    <>
      <label className="block">
        <span className="field-label !text-sm">{e.category}</span>
        <select name="category" defaultValue={f.cat} onChange={push} className={sel}>
          <option value="">{e.anyCategory}</option>
          {CATEGORIES.filter((c) => c.id !== "other").map((c) => <option key={c.id} value={c.id}>{lang === "ne" ? c.ne : c.en}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="field-label !text-sm">{e.city}</span>
        <select name="city" defaultValue={f.city} onChange={push} className={sel}>
          <option value={ANYWHERE}>{t.nav.anywhere}</option>
          {HEADER_CITIES.map((c) => <option key={c} value={c}>{c === "Online" ? t.browse.online : c}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="field-label !text-sm">{e.radius}</span>
        <select name="radius" defaultValue={f.radius ?? ""} onChange={push} className={sel} disabled={f.city === "Online" || f.city === ANYWHERE}>
          <option value="">{e.anyDistance}</option>
          {RADII.map((r) => <option key={r} value={r}>{e.within(r)}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="field-label !text-sm">{e.price}</span>
        <select name="max" defaultValue={f.max ?? ""} onChange={push} className={sel}>
          <option value="">{e.anyPrice}</option>
          {PRICE_CAPS.map((p) => <option key={p} value={p}>{lang === "ne" ? `रु. ${num(p, lang)}` : `Rs. ${num(p, lang)}`}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="field-label !text-sm">{e.sort}</span>
        <select name="sort" defaultValue={f.sort} onChange={push} className={sel}>
          {(["best", "near", "rating", "price"] as const)
            .filter((s) => f.view === "pros" || s !== "rating")
            .map((s) => <option key={s} value={s}>{e.sorts[s]}</option>)}
        </select>
      </label>
    </>
  );

  if (compact) {
    // Slim one-line toolbar (Explore): every control is a small pill; extra checkboxes sit in "Other filters".
    const pill = "h-10 max-w-[9.5rem] appearance-none truncate rounded-full border border-line-strong bg-surface pl-3.5 pr-7 text-[0.9rem] font-semibold hover:border-accent focus:border-accent";
    const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2345564d' stroke-width='2.4'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 0.75rem center", backgroundSize: "14px" };
    const extras = Number(f.online) + Number(f.women) + Number(f.verified);
    return (
      <form ref={form} action={path} method="get" role="search" aria-busy={pending}
        onSubmit={(ev) => { ev.preventDefault(); push(); }} className="flex flex-wrap items-center gap-2">
        {showView && <input type="hidden" name="view" value={f.view} />}
        <label className="relative w-full sm:w-40 xl:w-48">
          <span className="sr-only">{e.search}</span>
          <input name="q" type="search" defaultValue={f.q} maxLength={80} placeholder={e.searchPh}
            className="h-10 w-full rounded-full border border-line-strong bg-surface pl-4 pr-10 text-[0.93rem] hover:border-accent focus:border-accent" />
          <button type="submit" aria-label={e.search} className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-accent"><Search size={17} aria-hidden /></button>
        </label>
        <label><span className="sr-only">{e.category}</span>
          <select name="category" defaultValue={f.cat} onChange={push} className={pill} style={chevron}>
            <option value="">{e.category}</option>
            {CATEGORIES.filter((c) => c.id !== "other").map((c) => <option key={c.id} value={c.id}>{lang === "ne" ? c.ne : c.en}</option>)}
          </select></label>
        <label><span className="sr-only">{e.city}</span>
          <select name="city" defaultValue={f.city} onChange={push} className={pill} style={chevron}>
            <option value={ANYWHERE}>{t.nav.anywhere}</option>
            {HEADER_CITIES.map((c) => <option key={c} value={c}>{c === "Online" ? t.browse.online : c}</option>)}
          </select></label>
        <label><span className="sr-only">{e.radius}</span>
          <select name="radius" defaultValue={f.radius ?? ""} onChange={push} className={pill} style={chevron} disabled={f.city === "Online" || f.city === ANYWHERE}>
            <option value="">{e.anyDistance}</option>
            {RADII.map((r) => <option key={r} value={r}>{e.within(r)}</option>)}
          </select></label>
        <label><span className="sr-only">{e.price}</span>
          <select name="max" defaultValue={f.max ?? ""} onChange={push} className={pill} style={chevron}>
            <option value="">{e.anyPrice}</option>
            {PRICE_CAPS.map((p) => <option key={p} value={p}>{lang === "ne" ? `रु. ${num(p, lang)}` : `Rs. ${num(p, lang)}`}</option>)}
          </select></label>
        <details className="relative">
          <summary className={`inline-flex h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border px-3.5 text-[0.9rem] font-semibold hover:border-accent [&::-webkit-details-marker]:hidden ${extras ? "border-accent bg-accent-soft text-accent" : "border-line-strong bg-surface"}`}>
            <SlidersHorizontal size={15} aria-hidden /> <span className="whitespace-nowrap">{e.otherFilters}{extras ? ` (${extras})` : ""}</span>
          </summary>
          <div className="absolute left-0 top-12 z-30 w-64 space-y-2 rounded-[12px] border border-line bg-surface p-3 shadow-[0_16px_40px_-16px_rgba(13,26,20,.45)]">
            <Check name="online" label={e.onlineOnly} on={f.online} />
            {f.view === "pros" && <Check name="women" label={e.womenLedOnly} on={f.women} />}
            {f.view === "tasks" && canSeeWomenOnly && <Check name="women" label={e.womenOnly} on={f.women} />}
            {f.view === "pros" && <Check name="verified" label={e.verifiedOnly} on={f.verified} />}
          </div>
        </details>
        <label><span className="sr-only">{e.sort}</span>
          <select name="sort" defaultValue={f.sort} onChange={push} className={pill} style={chevron}>
            {(["best", "near", "rating", "price"] as const)
              .filter((s) => f.view === "pros" || s !== "rating")
              .map((s) => <option key={s} value={s}>{e.sorts[s]}</option>)}
          </select></label>
        {(f.q || f.cat || f.radius || f.max || extras > 0 || f.sort !== "best") && <a href={`${path}${showView ? `?view=${f.view}` : ""}`} className="btn btn-quiet !min-h-10 text-sm"><X size={15} aria-hidden /> {e.clear}</a>}
      </form>
    );
  }

  return (
    <form ref={form} action={path} method="get" role="search" aria-busy={pending}
      onSubmit={(ev) => { ev.preventDefault(); push(); }} className="space-y-4">
      {showView && <input type="hidden" name="view" value={f.view} />}
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">{e.search}</span>
          <Search size={18} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" type="search" defaultValue={f.q} maxLength={80} placeholder={e.searchPh} className="input !min-h-12 !pl-10" />
        </label>
        <button type="submit" className="btn btn-primary !min-h-12">{e.search}</button>
      </div>

      {/* Desktop: always visible. Mobile: collapsed behind a Filters toggle. Rendered once so values never conflict. */}
      <button type="button" className="btn btn-ghost !min-h-11 w-full lg:hidden" aria-expanded={open} aria-controls="filter-fields" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={17} aria-hidden /> {e.filters}
      </button>
      <div id="filter-fields" className={`${open ? "grid" : "hidden"} gap-3 xs:grid-cols-2 lg:grid lg:grid-cols-5`}>{fields}</div>

      <div className="flex flex-wrap items-center gap-2">
        <Check name="online" label={e.onlineOnly} on={f.online} />
        {f.view === "pros" && <Check name="women" label={e.womenLedOnly} on={f.women} />}
        {f.view === "tasks" && canSeeWomenOnly && <Check name="women" label={e.womenOnly} on={f.women} />}
        {f.view === "pros" && <Check name="verified" label={e.verifiedOnly} on={f.verified} />}
        <a href={`${path}${showView ? `?view=${f.view}` : ""}`} className="btn btn-quiet ml-auto"><X size={16} aria-hidden /> {e.clear}</a>
      </div>
    </form>
  );
}
