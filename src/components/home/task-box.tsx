"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mic, MicOff, MapPin, Sparkles, Zap, Info, Pencil, CalendarDays, Globe2 } from "lucide-react";
import { postJson, useCity, useI18n } from "@/components/providers";
import { ANYWHERE, HEADER_CITIES } from "@/lib/geo";
import { category } from "@/lib/pricing";
import { rsRange } from "@/lib/format";

interface Draft {
  source: "ai" | "fallback";
  task: { category: string; title: string; details: string; days: number; online: boolean };
  range: { low: number; high: number; mid: number; basis: string[] };
}

/* Minimal typing for the Web Speech API (not in TS's DOM lib everywhere). */
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> ; resultIndex: number }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
function getRecognition(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function TaskBox() {
  const { t, lang } = useI18n();
  const { city: viewCity, setCity } = useCity();
  // "All of Nepal" is for browsing; a job still needs a place, so the box asks for one.
  const city = viewCity === ANYWHERE ? "" : viewCity;
  const router = useRouter();
  const h = t.home.hero, d = t.home.draft;
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const rec = useRef<Recognition | null>(null);

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => setCanSpeak(getRecognition() !== null), []);
  useEffect(() => () => rec.current?.stop(), []);

  const toggleMic = () => {
    if (listening) { rec.current?.stop(); return; }
    const R = getRecognition();
    if (!R) return;
    const r = new R();
    r.lang = lang === "ne" ? "ne-NP" : "en-IN";
    r.interimResults = true;
    r.continuous = false;
    const base = text ? `${text.trim()} ` : "";
    r.onresult = (e) => {
      let said = "";
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript;
      setText((base + said).slice(0, 1000));
    };
    r.onerror = () => { setError(h.micError); setListening(false); };
    r.onend = () => { setListening(false); area.current?.focus(); };
    rec.current = r;
    setError(null);
    setListening(true);
    r.start();
  };

  const submit = async (value = text) => {
    const v = value.trim();
    if (v.length < 4 || v.split(/\s+/).length < 2) { setError(h.tooShort); area.current?.focus(); return; }
    setBusy(true); setError(null); setDraft(null); setShowWhy(false);
    const r = await postJson<Draft>("/api/ai/parse-task", { text: v, lang, city: city === "Online" || !city ? undefined : city });
    setBusy(false);
    if (!r.ok) { setError(r.error === "offline" ? t.errors.offline : t.errors.generic); return; }
    setDraft({ source: r.source, task: r.task, range: r.range });
    requestAnimationFrame(() => resultRef.current?.focus());
  };

  const post = () => {
    if (!draft) return;
    try { sessionStorage.setItem("sk_draft", JSON.stringify({ text, city: city || undefined, ...draft, at: Date.now() })); } catch { /* ignore */ }
    router.push("/post");
  };

  const cat = draft ? category(draft.task.category) : null;

  return (
    <div className="relative">
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        className="notch-frame"
        aria-busy={busy}
      >
        <div className="notch-card terrace-edge p-4 sm:p-5">
          <label htmlFor={`${id}-t`} className="font-display block text-lg font-bold">{h.taskLabel}</label>
          <div className="relative mt-2">
            <textarea
              id={`${id}-t`}
              ref={area}
              value={text}
              onChange={(e) => { setText(e.target.value.slice(0, 1000)); if (error) setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(); }}
              rows={3}
              maxLength={1000}
              placeholder={h.placeholder}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-help${error ? ` ${id}-err` : ""}`}
              className="input min-h-[6.5rem] resize-y py-3 pr-14 leading-relaxed"
            />
            {canSpeak && (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? h.micStop : h.mic}
                title={listening ? h.micStop : h.mic}
                className={`absolute right-2.5 top-2.5 inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
                  listening ? "border-danger bg-danger text-white" : "border-line-strong bg-surface text-accent hover:border-accent"
                }`}
              >
                {listening ? <MicOff size={18} aria-hidden /> : <Mic size={18} aria-hidden />}
              </button>
            )}
          </div>
          <p id={`${id}-help`} className="sr-only">{canSpeak ? h.micNote : ""}</p>
          {listening && <p role="status" className="mt-1.5 text-sm font-semibold text-danger">{h.listening} <span className="font-normal text-muted">{h.micNote}</span></p>}
          {error && <p id={`${id}-err`} role="alert" className="field-error">{error}</p>}

          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <label className="relative flex items-center sm:w-52">
              <span className="sr-only">{h.cityLabel}</span>
              <MapPin size={16} aria-hidden className="pointer-events-none absolute left-3 text-accent" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="input !min-h-12 appearance-none !pl-9 !pr-8 text-[0.98rem] font-semibold"
              >
                {!city && <option value="" disabled>{t.nav.city}…</option>}
                {HEADER_CITIES.map((c) => <option key={c} value={c}>{c === "Online" ? t.nav.onlineWork : c}</option>)}
              </select>
            </label>
            <button type="submit" className="btn btn-primary !min-h-12 sm:ml-auto" disabled={busy}>
              {busy ? <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />{h.working}</> : <>{h.submit}<ArrowRight size={18} aria-hidden /></>}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-muted">{h.tryLabel}:</span>
        {h.examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => { setText(ex); void submit(ex); }}
            lang={/[ऀ-ॿ]/.test(ex) ? "ne" : "en"}
            className="rounded-[4px] border border-line bg-surface px-2.5 py-1 text-left text-[0.9rem] hover:border-accent hover:text-accent"
          >
            {ex}
          </button>
        ))}
      </div>

      {/* Result: the drafted task as an offer-ticket */}
      <div aria-live="polite">
        {draft && cat && (
          <div ref={resultRef} tabIndex={-1} className="mt-5 outline-none rise" style={{ ["--delay" as string]: "0s" }}>
            <div className="notch-frame"><div className="ticket">
              <div className="px-6 pb-4 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-xs font-bold ${draft.source === "ai" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>
                    {draft.source === "ai" ? <Sparkles size={13} aria-hidden /> : <Zap size={13} aria-hidden />}
                    {draft.source === "ai" ? d.sourceAi : d.sourceFallback}
                  </span>
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted">{d.title}</p>
                <h3 className="font-display mt-1 text-xl font-bold leading-snug">{draft.task.title}</h3>
                {draft.task.details && draft.task.details !== draft.task.title && (
                  <p className="mt-1.5 line-clamp-3 text-[0.95rem] text-muted">{draft.task.details}</p>
                )}
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <li><span className="text-muted">{d.category}:</span> <strong>{lang === "ne" ? cat.ne : cat.en}</strong></li>
                  <li className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden className="text-muted" /> {d.days(draft.task.days)}</li>
                  {draft.task.online && <li className="inline-flex items-center gap-1"><Globe2 size={14} aria-hidden className="text-muted" /> {d.online}</li>}
                </ul>
              </div>
              <div className="perforation mx-5" aria-hidden />
              <div className="flex flex-col gap-3 px-6 pb-5 pt-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">{d.fairRange}</p>
                  <p className="font-display text-2xl font-extrabold text-accent">{rsRange(draft.range.low, draft.range.high, lang)}</p>
                  <button type="button" onClick={() => setShowWhy((s) => !s)} aria-expanded={showWhy}
                    className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-accent underline-offset-4 hover:underline">
                    <Info size={14} aria-hidden /> {d.why}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost !min-h-11" onClick={() => { setDraft(null); area.current?.focus(); }}>
                    <Pencil size={16} aria-hidden /> {d.edit}
                  </button>
                  <button type="button" className="btn btn-primary !min-h-11" onClick={post}>
                    {d.post} <ArrowRight size={18} aria-hidden />
                  </button>
                </div>
              </div>
              {showWhy && (
                <div className="mx-5 mb-5 rounded-md bg-surface-2 p-3 text-sm">
                  <p className="font-semibold">{d.fromTable}</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-muted">
                    {draft.range.basis.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                </div>
              )}
            </div></div>
          </div>
        )}
      </div>
    </div>
  );
}
