"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Briefcase,
  GraduationCap,
  PartyPopper,
  Plane,
  Scale,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/components/providers";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { THEMES, type ShowcaseTask, type ThemeId } from "@/lib/showcase";
import { category, fairRange } from "@/lib/pricing";
import { rsRange } from "@/lib/format";

const TAB_ICONS: Record<ThemeId, LucideIcon> = {
  moving: Truck,
  repairs: Wrench,
  business: Briefcase,
  events: PartyPopper,
  study: GraduationCap,
  family: Plane,
};
const TINTS = [
  "bg-[#e3f2e6] text-[#1E8E4E] dark:bg-[#16321f] dark:text-[#8fd99a]",
  "bg-[#fdf1d6] text-[#8a5a00] dark:bg-[#3a2c0a] dark:text-[#f6d27a]",
  "bg-[#fbe9e3] text-[#8a3a1d] dark:bg-[#3a1d12] dark:text-[#f0b49c]",
  "bg-[#e6eefc] text-[#1d4f9a] dark:bg-[#14243d] dark:text-[#9dbcf2]",
];

/**
 * "See what you can get done": theme tabs and two rows of example task cards that slide sideways
 * (opposite directions, pause on hover/focus, still for reduced motion). Clicking a card starts a
 * task with that text already filled in.
 */
export function Showcase({ visitor = false }: { visitor?: boolean }) {
  const { t, lang } = useI18n();
  const s = t.home.landing.showcase;
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeId>("moving");
  const tasks = THEMES.find((x) => x.id === theme)!.tasks;
  const rows = [tasks.slice(0, 4), tasks.slice(4)];

  const start = (task: ShowcaseTask) => {
    try {
      sessionStorage.setItem(
        "sk_draft",
        JSON.stringify({ text: lang === "ne" ? task.ne : task.en, at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    router.push(visitor ? "/signup?next=%2Fpost" : "/post");
  };

  const card = (task: ShowcaseTask, i: number, copy: number) => {
    const Icon = CATEGORY_ICONS[task.cat];
    const c = category(task.cat);
    const r = fairRange({ category: task.cat, days: task.days ?? 1, quantity: task.qty });
    const title = lang === "ne" ? task.ne : task.en;
    return (
      <li
        key={`${task.en}-${copy}`}
        aria-hidden={copy > 0 || undefined}
        className="w-[19rem] shrink-0 sm:w-[22rem]"
      >
        <button
          type="button"
          tabIndex={copy > 0 ? -1 : undefined}
          onClick={() => start(task)}
          aria-label={`${title} — ${s.postLike}`}
          className="border-line bg-surface hover:border-accent flex h-full w-full flex-col justify-between gap-4 rounded-[14px] border p-5 text-left transition-shadow hover:shadow-[0_12px_30px_-14px_rgba(13,26,20,.4)]"
        >
          <span className="flex items-start gap-3.5">
            <span
              className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${TINTS[i % TINTS.length]}`}
            >
              <Icon size={26} strokeWidth={1.7} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="text-muted block text-xs font-bold tracking-wider uppercase">
                {lang === "ne" ? c.ne : c.en}
              </span>
              <span className="font-display mt-1 block text-lg leading-snug font-bold">{title}</span>
            </span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className="bg-accent-soft text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold">
              <Scale size={14} aria-hidden /> {s.fair}
            </span>
            <span className="font-display text-lg font-extrabold">{rsRange(r.low, r.high, lang)}</span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <section aria-labelledby="show-h" className="pt-20 lg:pt-28">
      <div className="mx-auto max-w-[88rem] px-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <h2
            id="show-h"
            className="font-display text-[2.2rem] leading-tight font-extrabold sm:text-6xl"
            lang={lang}
          >
            {s.title}
          </h2>
          <span className="demo-tag mb-2">{s.example}</span>
        </div>
        <p className="text-muted mt-3 max-w-2xl text-lg">{s.lead}</p>

        <div
          role="tablist"
          aria-label={s.title}
          className="border-line mt-7 flex [scrollbar-width:none] gap-1 overflow-x-auto border-b-2"
        >
          {THEMES.map(({ id }) => {
            const Icon = TAB_ICONS[id];
            const on = theme === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="show-panel"
                onClick={() => setTheme(id)}
                className={`-mb-0.5 inline-flex shrink-0 items-center gap-2 border-b-[3px] px-4 py-3 font-semibold transition-colors ${on ? "border-accent text-accent" : "text-text hover:text-accent border-transparent"}`}
              >
                <Icon size={18} aria-hidden /> {s.tabs[id]}
              </button>
            );
          })}
        </div>
      </div>

      {/* key=theme restarts the slide when the tab changes */}
      <div id="show-panel" role="tabpanel" key={theme} className="marquee-x mt-8 space-y-5 overflow-hidden">
        {rows.map((row, ri) => (
          <div key={ri} className="relative">
            <ul className={`flex w-max gap-5 ${ri === 0 ? "slide-left" : "slide-right"}`}>
              {[0, 1, 2].map((copy) => row.map((task, i) => card(task, i + ri, copy)))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
