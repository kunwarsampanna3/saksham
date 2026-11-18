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
export function FilterBar({ f, showView = true, canSeeWomenOnly }: { f: Filters; showView?: boolean; canSeeWomenOnly: boolean }) {
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
