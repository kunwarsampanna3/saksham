"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, BadgeCheck, GraduationCap, Sparkles, Star } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { category } from "@/lib/pricing";
import { num, rs } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";
import type { PlanSkill, Suggested } from "@/lib/ai/suggest";

type Mode = "match" | "coach";
type Result =
  | { mode: "match"; source: "ai" | "fallback"; people: Suggested[] }
  | { mode: "coach"; source: "ai" | "fallback"; summary: string; skills: PlanSkill[] };

export function MatchView({
  initial,
  connected,
  homeCity,
  cities,
}: {
  initial: Mode;
  connected: boolean;
  homeCity: string;
  cities: string[];
}) {
  const { t, lang } = useI18n();
  const m = t.match;
  const [mode, setMode] = useState<Mode>(initial);
  const [text, setText] = useState("");
  const [city, setCity] = useState(homeCity);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const latest = useRef(0);

  const switchTo = (next: Mode) => {
    latest.current++; // an answer still on its way belongs to the other tab
    setMode(next);
    setResult(null);
    setErr(null);
    setBusy(false);
  };

  const ask = async () => {
    const need = text.trim();
    if (need.length < 4) return setErr(m.errors.text);
    const money = budget ? Number(budget) : null;
    if (mode === "match" && money !== null && (!Number.isInteger(money) || money < 1 || money > 1_000_000))
      return setErr(m.errors.budget);
    const mine = ++latest.current;
    setBusy(true);
    setErr(null);
    setResult(null);
    const r = await postJson<Result>(
      "/api/ai/suggest",
      mode === "match" ? { mode, text: need, lang, city, budget: money } : { mode, text: need, lang },
    );
    if (mine !== latest.current) return;
    setBusy(false);
    if (r.ok) return setResult(r);
    const errors: Record<string, string> = m.errors;
    setErr(r.error === "offline" ? t.errors.offline : ((r.error && errors[r.error]) ?? t.errors.generic));
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div
        role="tablist"
        aria-label={m.title}
        className="bg-surface-2 grid grid-cols-2 gap-1 rounded-[8px] p-1"
      >
        {(["match", "coach"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={mode === k}
            onClick={() => switchTo(k)}
            className={`min-h-11 rounded-[6px] px-2 font-semibold ${mode === k ? "bg-accent text-accent-contrast" : "hover:text-accent"}`}
          >
            {m.tabs[k]}
          </button>
        ))}
      </div>

      <form
        noValidate
        className="border-line bg-surface mt-4 space-y-3 rounded-[14px] border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label className="block">
          <span className="field-label">{mode === "match" ? m.matchLabel : m.coachLabel}</span>
          <textarea
            name="need"
            className="input resize-y py-3"
            rows={3}
            maxLength={500}
            value={text}
            placeholder={mode === "match" ? m.matchPh : m.coachPh}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {mode === "match" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">{m.city}</span>
              <select name="city" className="input" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">{m.anyCity}</option>
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">{m.budget}</span>
              <input
                name="budget"
                className="input"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000000}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
          </div>
        )}
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Sparkles size={17} aria-hidden /> {busy ? m.working : mode === "match" ? m.find : m.plan}
        </button>
        {!connected && <p className="text-muted text-sm">{m.offline}</p>}
        <p className="text-muted text-xs">{m.note}</p>
      </form>

      <div aria-live="polite" className="mt-6">
        {result && (
          <p
            data-source={result.source}
            className={`mb-3 inline-flex items-center gap-1.5 text-sm font-semibold ${result.source === "ai" ? "text-accent" : "text-muted"}`}
          >
            {result.source === "ai" && <Sparkles size={15} aria-hidden />}
            {result.source === "ai" ? m.byAi : m.byRules}
          </p>
        )}
        {result?.mode === "match" &&
          (result.people.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {result.people.map((p) => (
                <Person key={p.id} p={p} />
              ))}
            </ul>
          ) : (
            <p className="border-line-strong rounded-[10px] border border-dashed p-6 text-center">
              {m.noMatch}{" "}
              <Link href="/post" className="text-accent font-semibold hover:underline">
                {m.post}
              </Link>
            </p>
          ))}
        {result?.mode === "coach" && (
          <>
            {result.summary && <p className="mb-4 text-lg">{result.summary}</p>}
            <ol className="space-y-4">
              {result.skills.map((s) => {
                const c = category(s.category);
                const Icon = CATEGORY_ICONS[s.category];
                return (
                  <li
                    key={s.category}
                    data-skill={s.category}
                    className="border-line bg-surface rounded-[14px] border p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-display flex items-center gap-2 text-xl font-bold">
                        <Icon size={20} aria-hidden className="text-accent" /> {lang === "ne" ? c.ne : c.en}
                      </h2>
                      <Link
                        href={`/explore?category=${s.category}`}
                        className="text-accent inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                      >
                        {s.openJobs ? m.demand(num(s.openJobs, lang)) : m.seeJobs}
                        <ArrowRight size={14} aria-hidden />
                      </Link>
                    </div>
                    <p className="mt-2">{s.why}</p>
                    <p className="mt-3 text-sm font-semibold">{m.steps}</p>
                    <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                      {s.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                    <p className="mt-4 text-sm font-semibold">{m.learnFrom}</p>
                    {s.teachers.length ? (
                      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                        {s.teachers.map((p) => (
                          <Person key={p.id} p={p} />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted text-sm">{m.noTeachers}</p>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function Person({ p }: { p: Suggested }) {
  const { t, lang } = useI18n();
  const m = t.match;
  const rating = p.rating.toFixed(1);
  return (
    <li data-person={p.id} className="border-line bg-surface flex min-w-0 flex-col rounded-[12px] border p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-display text-lg font-bold">{p.name}</span>
        {p.verified && (
          <BadgeCheck size={17} role="img" aria-label={t.browse.verified} className="text-accent" />
        )}
        {p.example && <span className="demo-tag">{t.browse.example}</span>}
      </div>
      <p className="text-muted text-sm">{p.headline[lang]}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
        <span className="inline-flex items-center gap-1 font-semibold">
          {p.teacher && <GraduationCap size={15} aria-hidden />}
          {p.teacher ? m.teacher : m.works}
        </span>
        <span>{p.city}</span>
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
        {p.ratingCount ? (
          <span className="inline-flex items-center gap-1">
            <Star size={14} aria-hidden className="fill-marigold text-marigold" />
            {lang === "ne" ? toDeva(rating) : rating} ({num(p.ratingCount, lang)})
          </span>
        ) : (
          <span className="text-muted">{m.isNew}</span>
        )}
        {p.jobs > 0 && <span>{m.jobs(num(p.jobs, lang))}</span>}
        {p.priceFrom > 0 && <span>{m.from(rs(p.priceFrom, lang))}</span>}
      </p>
      {p.why && (
        <p className="bg-surface-2 mt-2 rounded-[6px] p-2.5 text-sm">
          <strong>{m.why}: </strong>
          {p.why}
        </p>
      )}
      <Link href={p.href} className="btn btn-ghost mt-3 !min-h-10 self-start text-sm">
        {m.open}
      </Link>
    </li>
  );
}
