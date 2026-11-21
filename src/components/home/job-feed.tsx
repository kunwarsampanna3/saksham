"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, Clock, Globe2, MapPin, Search, Users } from "lucide-react";
import { useI18n } from "@/components/providers";
import { category, type CategoryId } from "@/lib/pricing";
import { rs, rsRange } from "@/lib/format";

export interface Job {
  id: string;
  category: CategoryId;
  title: { en: string; ne: string };
  details: string;
  city: string;
  area?: string;
  online: boolean;
  days: number;
  budget: number | null;
  range: { low: number; high: number };
  offers: number;
  postedMinutesAgo: number;
  clientVerified: boolean;
  isExample: boolean;
  match: boolean;
}

type Tab = "best" | "recent" | "online";

/** Upwork-style job list for IT job seekers: tabs, search, and clear job cards. */
export function JobFeed({ jobs }: { jobs: Job[] }) {
  const { t, lang } = useI18n();
  const it = t.home.jobs;
  const [tab, setTab] = useState<Tab>("best");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const found = jobs.filter(
      (j) =>
        !needle ||
        `${j.title.en} ${j.title.ne} ${j.details} ${category(j.category).en}`.toLowerCase().includes(needle),
    );
    if (tab === "online")
      return found.filter((j) => j.online).sort((a, b) => a.postedMinutesAgo - b.postedMinutesAgo);
    if (tab === "recent") return found.slice().sort((a, b) => a.postedMinutesAgo - b.postedMinutesAgo);
    return found
      .slice()
      .sort((a, b) => Number(b.match) - Number(a.match) || a.postedMinutesAgo - b.postedMinutesAgo);
  }, [jobs, tab, q]);

  return (
    <section aria-labelledby="jobs-h" className="border-line bg-surface rounded-[14px] border">
      <div className="border-line border-b p-4 sm:p-5">
        <h2 id="jobs-h" className="font-display text-xl font-bold sm:text-2xl">
          {it.title}
        </h2>
        <p className="text-muted text-sm">{it.lead}</p>
        <label className="border-line-strong bg-bg mt-3 flex items-center gap-2 rounded-full border px-4">
          <Search size={17} aria-hidden className="text-muted" />
          <span className="sr-only">{it.searchPh}</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={it.searchPh}
            className="min-h-11 flex-1 bg-transparent outline-none"
          />
        </label>
        <div role="tablist" className="mt-3 flex [scrollbar-width:none] gap-5 overflow-x-auto">
          {(["best", "recent", "online"] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-[1px] border-b-2 pb-2 text-[0.95rem] font-semibold whitespace-nowrap ${tab === id ? "border-accent text-accent" : "text-muted hover:text-text border-transparent"}`}
            >
              {it.tabs[id]}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-muted p-6">{it.empty}</p>
      ) : (
        <ul className="divide-line divide-y">
          {list.map((j) => {
            const c = category(j.category);
            return (
              <li key={j.id}>
                <Link
                  href={`/task/${j.id}`}
                  className="group hover:bg-accent-soft/40 block p-4 transition-colors sm:p-5"
                >
                  <p className="text-muted flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} aria-hidden /> {t.home.live.ago(j.postedMinutesAgo)}
                    </span>
                    {j.isExample && <span className="demo-tag">{t.browse.example}</span>}
                    {j.match && (
                      <span className="bg-accent-soft text-accent rounded-full px-2 py-0.5 font-bold">
                        {it.matches}
                      </span>
                    )}
                  </p>
                  <h3
                    className="font-display group-hover:text-accent mt-1 text-[1.1rem] leading-snug font-bold group-hover:underline"
                    lang={lang}
                  >
                    {j.title[lang]}
                  </h3>
                  <p className="text-muted mt-1 text-sm">
                    {it.fixed} ·{" "}
                    {j.budget !== null ? (
                      <strong className="text-text">{it.clientPrice(rs(j.budget, lang))}</strong>
                    ) : (
                      <>
                        {it.fair}:{" "}
                        <strong className="text-text">{rsRange(j.range.low, j.range.high, lang)}</strong>
                      </>
                    )}{" "}
                    · {it.days(j.days)}
                  </p>
                  {j.details && j.details !== j.title.en && (
                    <p className="mt-2 line-clamp-2 text-[0.95rem]">{j.details}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="bg-surface-2 rounded-full px-3 py-1 text-xs font-semibold">
                      {lang === "ne" ? c.ne : c.en}
                    </span>
                    {j.online ? (
                      <span className="bg-surface-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                        <Globe2 size={12} aria-hidden /> {t.home.live.remote}
                      </span>
                    ) : (
                      <span className="bg-surface-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
                        <MapPin size={12} aria-hidden /> {j.area ? `${j.area}, ` : ""}
                        {j.city}
                      </span>
                    )}
                  </div>
                  <p className="text-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    {!j.isExample &&
                      (j.clientVerified ? (
                        <span className="text-accent inline-flex items-center gap-1 font-semibold">
                          <BadgeCheck size={14} aria-hidden /> {it.clientVerified}
                        </span>
                      ) : (
                        <span>{it.clientNotVerified}</span>
                      ))}
                    <span className="inline-flex items-center gap-1">
                      <Users size={13} aria-hidden /> {it.offers(j.offers)}
                    </span>
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
