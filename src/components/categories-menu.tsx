"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useI18n, useUser } from "@/components/providers";
import { useDismiss } from "@/components/use-dismiss";
import { CATEGORIES } from "@/lib/pricing";

type Mode = "client" | "provider";

/**
 * "Categories" mega menu: pick whether you want to hire or to find work, then a skill.
 * Hire → providers who do it; find work → open tasks in it.
 */
export function CategoriesMenu() {
  const { t, lang } = useI18n();
  const l = t.home.landing;
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  // Visitors and "both" accounts pick a side; single-role accounts only see their own.
  const both = !user || (user.roles.includes("client") && user.roles.includes("provider"));
  const [mode, setMode] = useState<Mode>(user?.activeRole === "provider" ? "provider" : "client");
  // Follow the Hiring / Working switch.
  useEffect(() => { setMode(user?.activeRole === "provider" ? "provider" : "client"); }, [user?.activeRole]);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const refs = useMemo(() => [btn, panel], []);
  useDismiss(open, close, refs, btn);
  useEffect(() => { setOpen(false); }, [path]);

  const cats = useMemo(() => CATEGORIES
    .filter((c) => c.id !== "other")
    .map((c) => ({ id: c.id, name: lang === "ne" ? c.ne : c.en }))
    .sort((a, b) => a.name.localeCompare(b.name, lang === "ne" ? "ne" : "en")), [lang]);
  const href = (id: string) => (mode === "client" ? `/professionals?category=${id}` : `/explore?view=tasks&category=${id}`);

  const choice = (m: Mode, label: string, lead: string) => (
    <button type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
      className={`w-full rounded-[10px] border-l-4 p-4 text-left transition-colors ${mode === m ? "border-accent bg-surface shadow-sm" : "border-transparent hover:bg-surface/70"}`}>
      <span className={`block text-xs font-bold uppercase tracking-wider ${mode === m ? "text-accent" : "text-muted"}`}>{label}</span>
      <span className="mt-0.5 block font-semibold leading-snug">{lead}</span>
    </button>
  );

  return (
    <div className="relative">
      <button ref={btn} type="button" aria-expanded={open} aria-controls="cat-menu" onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] font-semibold transition-colors hover:text-accent ${open ? "text-accent" : ""}`}>
        {l.navCats} <ChevronDown size={15} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div ref={panel} id="cat-menu" role="dialog" aria-label={l.menuTitle}

          className="fixed inset-x-3 top-[calc(var(--header-h)+6px)] z-50 mx-auto max-h-[calc(100dvh-var(--header-h)-24px)] max-w-[64rem] overflow-y-auto rounded-[14px] border border-line bg-surface shadow-[0_24px_60px_-20px_rgba(13,26,20,.45)]">
          <div className="grid lg:grid-cols-[17rem_1fr]">
            <div className="space-y-3 rounded-t-[14px] bg-accent-soft p-5 lg:rounded-l-[14px] lg:rounded-tr-none">
              <p className="font-display text-2xl font-extrabold leading-tight">{l.menuTitle}</p>
              {both ? <>
                <p className="text-muted">{l.menuLead}</p>
                {choice("client", l.asClient, l.asClientLead)}
                {choice("provider", l.asProvider, l.asProviderLead)}
              </> : <p className="font-semibold text-accent">{mode === "client" ? l.asClientLead : l.asProviderLead}</p>}
            </div>
            <div className="p-5">
              <ul className="columns-2 gap-x-6 sm:columns-3 lg:columns-4">
                {cats.map((c) => (
                  <li key={c.id} className="break-inside-avoid">
                    <Link href={href(c.id)} onClick={close} className="block rounded px-1.5 py-1.5 text-[0.95rem] font-semibold hover:bg-accent-soft hover:text-accent">{c.name}</Link>
                  </li>
                ))}
                <li className="break-inside-avoid">
                  <Link href={mode === "client" ? "/professionals" : "/explore"} onClick={close} className="block px-1.5 py-1.5 font-bold text-accent hover:underline">{l.viewAll}</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
