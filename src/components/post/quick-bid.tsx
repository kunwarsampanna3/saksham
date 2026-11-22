"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Sparkles, Minus, Plus, Globe2, Users, Send, ChevronDown, Check } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { CATEGORIES, category, fairRange, type CategoryId, type PriceOverrideLite } from "@/lib/pricing";
import { areasFor } from "@/lib/geo";
import { rs, rsRange } from "@/lib/format";

/** Popular first; the rest are in "More categories". */
const FEATURED: CategoryId[] = [
  "web-design",
  "coding",
  "it-support",
  "graphic-design",
  "tutoring",
  "tailoring",
  "electrician",
  "cleaning",
];

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const step = (n: number) => (n < 2000 ? 100 : n < 20000 ? 500 : 1000);

/**
 * Quick bid (inDrive-style): say what you need, set your own price inside a fair range, post.
 * Providers accept that price in one tap or offer theirs. AI only sorts the request (category + title); it never sets the price.
 */
export function QuickBid({
  homeCity,
  homeArea,
  counts,
  overrides = {},
}: {
  homeCity: string;
  homeArea?: string;
  counts: Record<string, number>;
  overrides?: Record<string, PriceOverrideLite>;
}) {
  const { t, lang } = useI18n();
  const q = t.post.quick;
  const router = useRouter();
  const [text, setText] = useState("");
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(1);
  const [online, setOnline] = useState(false);
  const [womenOnly, setWomenOnly] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [busy, setBusy] = useState<"ai" | "post" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [more, setMore] = useState(false);
  const rec = useRef<Recognition | null>(null);

  const city = homeCity === "Online" ? "Kathmandu" : homeCity;
  const area =
    homeArea && areasFor(city).some((a) => a.name === homeArea) ? homeArea : areasFor(city)[0]?.name;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    setCanSpeak(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const range = useMemo(
    () => (cat ? fairRange({ category: cat, days, city, online, override: overrides[cat] }) : null),
    [cat, days, city, online, overrides],
  );
  // Start the price at the middle of the fair range whenever the job changes.
  useEffect(() => {
    if (range) setPrice(range.mid);
  }, [range?.mid]); // eslint-disable-line react-hooks/exhaustive-deps

  const speak = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => Recognition;
      webkitSpeechRecognition?: new () => Recognition;
    };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = lang === "ne" ? "ne-NP" : "en-US";
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => {
      const said = Array.from(e.results)
        .map((x) => x[0].transcript)
        .join(" ");
      setText((s) => (s ? `${s} ${said}` : said));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  const sort = async () => {
    if (text.trim().length < 4) return setErr(q.needText);
    setBusy("ai");
    setErr(null);
    const r = await postJson<{
      source: "ai" | "fallback";
      task: { category: CategoryId; title: string; days: number; online: boolean };
    }>("/api/ai/parse-task", { text, lang, city });
    setBusy(null);
    if (!r.ok || !r.task) return setErr(r.error === "offline" ? t.errors.offline : t.errors.generic);
    setCat(r.task.category);
    setTitle(r.task.title);
    setDays(Math.max(1, r.task.days || 1));
    setOnline(!!r.task.online || category(r.task.category).online);
    setAiUsed(true);
    if (!FEATURED.includes(r.task.category)) setMore(true);
  };

  const post = async () => {
    setErr(null);
    if (!cat) return setErr(q.needCat);
    const name = (title || text).trim().slice(0, 80);
    if (name.length < 3) return setErr(q.needText);
    if (!price || price < 100) return setErr(t.post.errors.budget);
    setBusy("post");
    const r = await postJson<{ id: string }>("/api/tasks", {
      category: cat,
      title: name,
      details: text.trim().slice(0, 2000) || name,
      quantity: 1,
      days,
      city: online ? "Online" : city,
      area: online ? undefined : area,
      online,
      womenOnly,
      budget: price,
      flexible: true,
      aiSource: aiUsed ? "ai" : "manual",
    });
    setBusy(null);
    if (!r.ok || !r.id)
      return setErr(
        r.error && r.error in t.post.errors
          ? t.post.errors[r.error as keyof typeof t.post.errors]
          : t.errors.generic,
      );
    router.push(`/task/${r.id}`);
  };

  const state =
    !range || price === null ? null : price < range.low ? "low" : price > range.high ? "high" : "ok";
  const tiles = more ? CATEGORIES.filter((c) => c.id !== "other").map((c) => c.id as CategoryId) : FEATURED;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        {/* describe */}
        <section className="bg-forest rounded-[16px] p-5 text-white sm:p-6">
          <p className="text-leaf text-xs font-bold tracking-wider uppercase">{q.kicker}</p>
          <h2 className="font-display mt-1 text-2xl leading-tight font-extrabold sm:text-3xl">{q.heading}</h2>
          <label htmlFor="qb-text" className="sr-only">
            {q.describe}
          </label>
          <div className="mt-4 flex flex-col gap-2 rounded-[12px] bg-white p-2 sm:flex-row sm:items-center">
            <input
              id="qb-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder={q.describePh}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void sort();
                }
              }}
              className="min-h-11 flex-1 rounded-md px-3 text-[1rem] text-[#10201a] outline-none placeholder:text-[#6b7c74]"
            />
            <div className="flex gap-2">
              {canSpeak && (
                <button
                  type="button"
                  onClick={speak}
                  aria-pressed={listening}
                  aria-label={listening ? q.listening : q.speak}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${listening ? "bg-clay animate-pulse text-white" : "text-forest bg-[#eef5f0]"}`}
                >
                  {listening ? <MicOff size={19} aria-hidden /> : <Mic size={19} aria-hidden />}
                </button>
              )}
              <button
                type="button"
                onClick={() => void sort()}
                disabled={busy !== null}
                className="btn bg-leaf text-forest !min-h-11 flex-1 font-bold hover:brightness-95 sm:flex-none"
              >
                <Sparkles size={17} aria-hidden /> {busy === "ai" ? q.sorting : q.sortIt}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-white/75">{q.aiNote}</p>
        </section>

        {/* 1 · category */}
        <section aria-labelledby="qb-1">
          <h3 id="qb-1" className="text-accent text-xs font-bold tracking-wider uppercase">
            {q.step1}
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((id) => {
              const c = category(id);
              const Icon = CATEGORY_ICONS[id];
              const on = cat === id;
              const r = fairRange({ category: id, days: 1, city, online: c.online, override: overrides[id] });
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCat(id);
                      setOnline(c.online);
                    }}
                    aria-pressed={on}
                    className={`relative flex h-full w-full flex-col items-start gap-1 rounded-[12px] border-[1.5px] p-3 text-left transition-colors ${on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent"}`}
                  >
                    {on && <Check size={16} aria-hidden className="text-accent absolute top-2.5 right-2.5" />}
                    <span className="bg-accent-soft text-accent grid h-9 w-9 place-items-center rounded-lg">
                      <Icon size={18} aria-hidden />
                    </span>
                    <span className="leading-tight font-semibold">{lang === "ne" ? c.ne : c.en}</span>
                    <span className="text-accent text-xs font-bold">{q.from(rs(r.low, lang))}</span>
                    <span className="text-muted text-xs">{q.providers(counts[id] ?? 0)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!more && (
            <button type="button" onClick={() => setMore(true)} className="btn btn-quiet mt-2 text-sm">
              <ChevronDown size={16} aria-hidden /> {q.more}
            </button>
          )}
        </section>

        {/* 2 · price */}
        <section aria-labelledby="qb-2" className={cat ? "" : "pointer-events-none opacity-50"}>
          <h3 id="qb-2" className="text-accent text-xs font-bold tracking-wider uppercase">
            {q.step2}
          </h3>
          <div className="border-line bg-surface mt-3 rounded-[14px] border p-5">
            <label className="block">
              <span className="field-label">{q.titleLabel}</span>
              <input
                className="input"
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={text.slice(0, 80) || q.describePh}
              />
            </label>

            <p className="field-label mt-5">{q.yourPrice}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={q.less}
                disabled={!price || price <= 100}
                onClick={() => price && setPrice(Math.max(100, price - step(price)))}
                className="border-line-strong text-text hover:border-accent hover:text-accent grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 disabled:opacity-40"
              >
                <Minus size={22} aria-hidden />
              </button>
              <output
                aria-live="polite"
                className="font-display min-w-0 flex-1 text-center text-4xl font-extrabold tabular-nums sm:text-5xl"
              >
                {price ? rs(price, lang) : "—"}
              </output>
              <button
                type="button"
                aria-label={q.moreMoney}
                disabled={!price}
                onClick={() => price && setPrice(price + step(price))}
                className="border-line-strong text-text hover:border-accent hover:text-accent grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 disabled:opacity-40"
              >
                <Plus size={22} aria-hidden />
              </button>
            </div>
            {range && (
              <>
                <p className="text-muted mt-3 text-center text-sm">
                  {q.fair}: <strong className="text-text">{rsRange(range.low, range.high, lang)}</strong> ·{" "}
                  {t.post.fairFrom}
                </p>
                {state && (
                  <p
                    className={`mt-1 text-center text-sm font-semibold ${state === "ok" ? "text-accent" : state === "low" ? "text-danger" : "text-muted"}`}
                  >
                    {state === "ok" ? q.inRange : state === "low" ? q.low : q.high}
                  </p>
                )}
              </>
            )}

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">{q.days}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  inputMode="numeric"
                  className="input"
                  value={days}
                  onChange={(e) => setDays(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                />
              </label>
              <label className="border-line flex items-center gap-2 self-end rounded-md border px-3 py-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={online}
                  onChange={(e) => setOnline(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />{" "}
                <Globe2 size={16} aria-hidden className="text-accent" /> {q.online}
              </label>
              <label className="border-line flex items-center gap-2 self-end rounded-md border px-3 py-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={womenOnly}
                  onChange={(e) => setWomenOnly(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />{" "}
                <Users size={16} aria-hidden className="text-accent" /> {q.womenOnly}
              </label>
            </div>
            <p className="text-muted mt-2 text-xs">
              {online ? q.whereOnline : q.where(area ? `${area}, ${city}` : city)}
            </p>
          </div>
        </section>

        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        <button
          type="button"
          onClick={() => void post()}
          disabled={busy !== null || !cat}
          className="btn btn-primary !min-h-14 w-full text-lg sm:w-auto sm:px-10"
        >
          <Send size={19} aria-hidden />{" "}
          {busy === "post" ? q.posting : price ? q.postAt(rs(price, lang)) : q.post}
        </button>
      </div>

      {/* how it works */}
      <aside className="space-y-3 lg:sticky lg:top-[calc(var(--header-h)+16px)] lg:self-start">
        <section className="border-line bg-surface rounded-[14px] border p-5">
          <h3 className="font-display text-lg font-bold">{q.howTitle}</h3>
          <ol className="mt-3 space-y-3">
            {q.how.map((s, i) => (
              <li key={s} className="flex gap-3 text-sm">
                <span className="bg-accent text-accent-contrast grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold">
                  {i + 1}
                </span>
                <span className="pt-1">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
