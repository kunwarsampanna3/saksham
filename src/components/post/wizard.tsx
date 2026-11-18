"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles, Zap, MapPin, Globe2, CalendarDays, Users, Plane, X, ImagePlus, Info } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { TerraceSteps } from "@/components/terrace-steps";
import { shrinkImage } from "@/components/verify/photo-input";
import { CATEGORIES, category, fairRange, isCountable, type CategoryId, type PriceOverrideLite } from "@/lib/pricing";
import { CITY_COORDS, areasFor, ABROAD_COUNTRIES } from "@/lib/geo";
import { rs, rsRange } from "@/lib/format";

type Source = "ai" | "fallback" | "manual";
interface Draft {
  text?: string;
  task?: { category: CategoryId; title: string; details: string; days: number; quantity?: number; online: boolean };
  source?: Source;
  providerId?: string;
  providerName?: string;
  mode?: "quote" | "book";
  city?: string;
  area?: string;
  family?: { country: (typeof ABROAD_COUNTRIES)[number]; familyName: string };
}

const CITIES = Object.keys(CITY_COORDS);
const todayIso = () => new Date().toISOString().slice(0, 10);

export function PostWizard({ homeCity, homeArea, overrides = {} }: { homeCity: string; homeArea?: string; overrides?: Record<string, PriceOverrideLite> }) {
  const { t, lang } = useI18n();
  const p = t.post;
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [cat, setCat] = useState<CategoryId | "">("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [days, setDays] = useState(1);
  const [source, setSource] = useState<Source>("manual");
  const [photos, setPhotos] = useState<Blob[]>([]);
  const [online, setOnline] = useState(false);
  const [city, setCity] = useState(CITIES.includes(homeCity) ? homeCity : "Kathmandu");
  const [area, setArea] = useState(homeArea ?? "");
  const [flexible, setFlexible] = useState(true);
  const [dueDate, setDueDate] = useState("");
  const [familyOn, setFamilyOn] = useState(false);
  const [country, setCountry] = useState<(typeof ABROAD_COUNTRIES)[number]>("Qatar");
  const [familyName, setFamilyName] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [womenOnly, setWomenOnly] = useState(false);
  const [busy, setBusy] = useState<"ai" | "post" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<Source | null>(null);

  // Prefill from Home's task box or a provider profile ("Request a quote" / "Book").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sk_draft");
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (d.text) setText(d.text);
      if (d.task) {
        setCat(d.task.category); setTitle(d.task.title); setDetails(d.task.details);
        setDays(d.task.days || 1); setQuantity(d.task.quantity || 1); setOnline(!!d.task.online);
        setSource(d.source ?? "fallback"); setAiNote(d.source ?? "fallback");
      }
      if (d.city && CITIES.includes(d.city)) { setCity(d.city); if (d.area) setArea(d.area); }
      if (d.family && ABROAD_COUNTRIES.includes(d.family.country)) { setFamilyOn(true); setCountry(d.family.country); setFamilyName(d.family.familyName ?? ""); }
      setBanner(d.providerName ? p.fromProvider(d.providerName) : d.task ? p.fromHome : null);
    } catch { /* ignore bad drafts */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const areas = useMemo(() => areasFor(city), [city]);
  useEffect(() => { if (!areas.some((a) => a.name === area)) setArea(areas[0]?.name ?? ""); }, [areas, area]);

  const range = useMemo(
    () => (cat ? fairRange({ category: cat, days, quantity, city, online, override: overrides[cat] }) : null),
    [cat, days, quantity, city, online, overrides],
  );
  const sliderMin = range ? Math.max(100, Math.round((range.low * 0.5) / 100) * 100) : 100;
  const sliderMax = range ? Math.round((range.high * 1.5) / 100) * 100 : 10000;

  const draftWithAi = async () => {
    if (text.trim().length < 4) { setErr(t.home.hero.tooShort); return; }
    setBusy("ai"); setErr(null);
    const r = await postJson<{ source: Source; task: Draft["task"] & { quantity: number } }>("/api/ai/parse-task", { text, lang, city: online ? undefined : city });
    setBusy(null);
    if (!r.ok || !r.task) { setErr(r.error === "offline" ? t.errors.offline : t.errors.generic); return; }
    setCat(r.task.category); setTitle(r.task.title); setDetails(r.task.details);
    setDays(r.task.days); setQuantity(r.task.quantity ?? 1); setOnline(r.task.online);
    setSource(r.source); setAiNote(r.source);
  };

  const validate = (s: number): string | null => {
    if (s === 0) {
      if (!cat) return p.errors.category;
      if (title.trim().length < 3) return p.errors.title;
    }
    if (s === 1) {
      if (!online && !area) return p.errors.area;
      if (!flexible && (!dueDate || dueDate < todayIso())) return p.errors.due_date;
    }
    if (s === 2 && budget !== null && budget < 100) return p.errors.budget;
    return null;
  };

  const go = (to: number) => {
    if (to > step) {
      const e = validate(step);
      if (e) { setErr(e); return; }
    }
    setErr(null);
    setStep(to);
    requestAnimationFrame(() => document.getElementById("wizard-h")?.focus());
  };

  const publish = async () => {
    for (const s of [0, 1, 2]) { const e = validate(s); if (e) { setErr(e); setStep(s); return; } }
    setBusy("post"); setErr(null);
    const r = await postJson<{ id: string }>("/api/tasks", {
      category: cat, title: title.trim(), details: details.trim(), quantity: isCountable(cat as string) ? quantity : 1, days,
      city: online ? "Online" : city, area: online ? undefined : area, online, womenOnly, budget,
      dueDate: flexible ? undefined : dueDate, flexible,
      family: familyOn ? { country, familyName: familyName.trim() } : undefined,
      aiSource: source,
    });
    if (!r.ok || !r.id) { setBusy(null); setErr(r.error && r.error in p.errors ? p.errors[r.error as keyof typeof p.errors] : p.errors.generic); return; }
    if (photos.length) {
      const fd = new FormData();
      photos.forEach((b, i) => fd.append("photos", b, `photo-${i}.jpg`));
      await fetch(`/api/tasks/${r.id}/photos`, { method: "POST", body: fd, credentials: "same-origin" }).catch(() => null);
    }
    try { sessionStorage.removeItem("sk_draft"); } catch { /* ignore */ }
    router.push(`/task/${r.id}`);
  };

  const field = "block";
  const budgetState = budget === null || !range ? null : budget < range.low ? "low" : budget > range.high ? "high" : "ok";

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        {banner && <p className="mb-5 flex items-center gap-2 rounded-[4px] bg-accent-soft px-3 py-2 text-sm font-semibold text-accent"><Info size={16} aria-hidden /> {banner}</p>}
        <TerraceSteps steps={p.steps} current={step} label={p.title} />
        <h2 id="wizard-h" tabIndex={-1} className="font-display text-2xl font-bold outline-none">{p.steps[step]}</h2>

        {step === 0 && (
          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="w-text" className="field-label">{p.describe}</label>
              <textarea id="w-text" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={p.describePh} className="input resize-y py-3" />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="button" className="btn btn-ghost" onClick={() => void draftWithAi()} disabled={busy !== null}>
                  <Sparkles size={17} aria-hidden /> {busy === "ai" ? p.drafting : p.draftAi}
                </button>
                {aiNote && (
                  <span role="status" className={`inline-flex items-center gap-1.5 text-sm font-semibold ${aiNote === "ai" ? "text-accent" : "text-muted"}`}>
                    {aiNote === "ai" ? <Sparkles size={14} aria-hidden /> : <Zap size={14} aria-hidden />} {aiNote === "ai" ? p.aiDone : p.aiFallback}
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className={field}><span className="field-label">{p.category}</span>
                <select className="input" value={cat} onChange={(e) => { setCat(e.target.value as CategoryId); if (source !== "manual") setSource("manual"); }}>
                  <option value="" disabled>—</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{lang === "ne" ? c.ne : c.en}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={field}><span className="field-label">{p.quantity}</span>
                  <input className="input" type="number" min={1} max={500} inputMode="numeric" value={quantity} disabled={!cat || !isCountable(cat)}
                    onChange={(e) => setQuantity(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} /></label>
                <label className={field}><span className="field-label">{p.days}</span>
                  <input className="input" type="number" min={1} max={60} inputMode="numeric" value={days}
                    onChange={(e) => setDays(Math.min(60, Math.max(1, Number(e.target.value) || 1)))} /></label>
              </div>
            </div>
            <label className={field}><span className="field-label">{p.taskTitle}</span>
              <input className="input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className={field}><span className="field-label">{p.details}</span>
              <textarea className="input resize-y py-3" rows={4} maxLength={2000} value={details} placeholder={p.detailsPh} onChange={(e) => setDetails(e.target.value)} /></label>

            <div>
              <span className="field-label">{p.photos}</span>
              <ul className="flex flex-wrap gap-2">
                {photos.map((b, i) => <PhotoThumb key={i} blob={b} onRemove={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} />)}
                {photos.length < 4 && (
                  <li>
                    <label className="flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[4px] border-[1.5px] border-dashed border-line-strong text-xs font-semibold text-muted hover:border-accent hover:text-accent">
                      <ImagePlus size={20} aria-hidden /> {p.addPhoto}
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={async (e) => {
                        const files = [...(e.target.files ?? [])].slice(0, 4 - photos.length);
                        e.target.value = "";
                        const shrunk = await Promise.all(files.map((f) => shrinkImage(f, 1600)));
                        setPhotos((ps) => [...ps, ...shrunk].slice(0, 4));
                      }} />
                    </label>
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="mt-5 space-y-6">
            <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
              <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
              <Globe2 size={17} aria-hidden className="text-accent" /> {p.online}
            </label>
            {!online && (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={field}><span className="field-label">{p.city}</span>
                  <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className={field}><span className="field-label">{p.area}</span>
                  <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
                    {areas.map((a) => <option key={a.name} value={a.name}>{lang === "ne" ? a.ne : a.name}</option>)}
                  </select></label>
              </div>
            )}
            <fieldset>
              <legend className="field-label">{p.when}</legend>
              <div className="flex flex-wrap gap-2">
                {[true, false].map((f) => (
                  <label key={String(f)} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 font-semibold ${flexible === f ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}>
                    <input type="radio" name="when" checked={flexible === f} onChange={() => setFlexible(f)} className="accent-[var(--accent)]" /> {f ? p.flexible : p.byDate}
                  </label>
                ))}
              </div>
              {!flexible && (
                <label className="mt-3 block max-w-xs"><span className="field-label">{p.date}</span>
                  <input type="date" className="input" min={todayIso()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
              )}
            </fieldset>
            <div className="rounded-[4px] border border-line p-4">
              <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
                <input type="checkbox" checked={familyOn} onChange={(e) => setFamilyOn(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
                <Plane size={17} aria-hidden className="text-accent" /> {p.family}
              </label>
              {familyOn && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className={field}><span className="field-label">{p.country}</span>
                    <select className="input" value={country} onChange={(e) => setCountry(e.target.value as typeof country)}>{ABROAD_COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label className={field}><span className="field-label">{p.familyName}</span>
                    <input className="input" maxLength={60} value={familyName} onChange={(e) => setFamilyName(e.target.value)} /></label>
                  <p className="text-sm text-muted sm:col-span-2">{p.familyNote}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mt-5 space-y-6">
            {range && (
              <div className="rounded-[4px] bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{p.fairRange}</p>
                <p className="font-display text-3xl font-extrabold text-accent">{rsRange(range.low, range.high, lang)}</p>
                <p className="text-sm text-muted">{p.fairFrom}</p>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted">{range.basis.map((b) => <li key={b}>{b}</li>)}</ul>
              </div>
            )}
            <fieldset>
              <legend className="field-label">{p.budgetTitle}</legend>
              <label className="flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" checked={budget === null} onChange={(e) => setBudget(e.target.checked ? null : range?.mid ?? 1000)} className="h-4 w-4 accent-[var(--accent)]" />
                {p.noBudget}
              </label>
              {budget !== null && (
                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <label htmlFor="w-budget" className="font-semibold">{p.yourBudget}</label>
                    <input type="number" min={100} step={100} inputMode="numeric" value={budget} aria-label={p.yourBudget}
                      onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} className="input !min-h-10 w-36 text-right font-display text-lg font-bold" />
                  </div>
                  <input id="w-budget" type="range" min={sliderMin} max={sliderMax} step={100} value={Math.min(Math.max(budget, sliderMin), sliderMax)}
                    onChange={(e) => setBudget(Number(e.target.value))} aria-valuetext={rs(budget, lang)} className="mt-3 w-full accent-[var(--accent)]" />
                  {range && (
                    <div className="relative mt-1 h-2 rounded bg-line" aria-hidden>
                      <div className="absolute inset-y-0 rounded bg-leaf" style={{
                        left: `${((range.low - sliderMin) / (sliderMax - sliderMin)) * 100}%`,
                        width: `${((range.high - range.low) / (sliderMax - sliderMin)) * 100}%`,
                      }} />
                    </div>
                  )}
                  {budgetState && (
                    <p className={`mt-2 text-sm font-semibold ${budgetState === "ok" ? "text-accent" : budgetState === "low" ? "text-danger" : "text-muted"}`}>
                      {budgetState === "ok" ? p.budgetOk : budgetState === "low" ? p.budgetLow : p.budgetHigh}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[4px] border border-line p-4">
              <input type="checkbox" checked={womenOnly} onChange={(e) => setWomenOnly(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
              <span><span className="flex items-center gap-1.5 font-semibold"><Users size={16} aria-hidden className="text-accent" /> {p.womenOnly}</span>
                <span className="text-sm text-muted">{p.womenOnlyNote}</span></span>
            </label>
          </div>
        )}

        {err && <p role="alert" className="field-error mt-5">{err}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          {step > 0 && <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}><ArrowLeft size={17} aria-hidden /> {p.back}</button>}
          {step < 2
            ? <button type="button" className="btn btn-primary ml-auto" onClick={() => go(step + 1)}>{p.next} <ArrowRight size={17} aria-hidden /></button>
            : <button type="button" className="btn btn-primary ml-auto" onClick={() => void publish()} disabled={busy !== null}>{busy === "post" ? p.publishing : p.publish}</button>}
        </div>
      </div>

      {/* Live preview */}
      <aside className="lg:col-span-5" aria-label={p.preview}>
        <div className="lg:sticky lg:top-[calc(var(--header-h)+16px)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{p.preview}</p>
          <div className="notch-frame"><div className="ticket">
            <div className="px-6 pb-4 pt-5">
              {cat ? <p className="text-sm font-semibold text-accent">{lang === "ne" ? category(cat).ne : category(cat).en}</p> : null}
              <h3 className="font-display mt-1 text-xl font-bold leading-snug">{title || <span className="text-muted">{p.previewEmpty}</span>}</h3>
              {details && <p className="mt-2 line-clamp-4 whitespace-pre-line text-[0.95rem] text-muted">{details}</p>}
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <li className="inline-flex items-center gap-1">{online ? <Globe2 size={14} aria-hidden /> : <MapPin size={14} aria-hidden />} {online ? t.browse.online : `${area ? `${area}, ` : ""}${city}`}</li>
                <li className="inline-flex items-center gap-1"><CalendarDays size={14} aria-hidden /> {flexible ? p.flexible : dueDate || "—"}</li>
                {cat && isCountable(cat) && quantity > 1 && <li>× {quantity}</li>}
                {womenOnly && <li className="inline-flex items-center gap-1 font-semibold text-[#8a3a1d] dark:text-[#f0b49c]"><Users size={14} aria-hidden /> {p.womenOnly}</li>}
                {familyOn && <li className="inline-flex items-center gap-1"><Plane size={14} aria-hidden /> {country}</li>}
              </ul>
              {photos.length > 0 && <ul className="mt-3 flex gap-1.5">{photos.map((b, i) => <PhotoThumb key={i} blob={b} small />)}</ul>}
            </div>
            <div className="perforation mx-5" aria-hidden />
            <div className="flex items-end justify-between px-6 pb-5 pt-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{p.fairRange}</p>
                <p className="font-display text-lg font-extrabold">{range ? rsRange(range.low, range.high, lang) : "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{p.yourBudget}</p>
                <p className="font-display text-lg font-extrabold text-accent">{budget !== null ? rs(budget, lang) : "—"}</p>
              </div>
            </div>
          </div></div>
        </div>
      </aside>
    </div>
  );
}

function PhotoThumb({ blob, onRemove, small }: { blob: Blob; onRemove?: () => void; small?: boolean }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => { const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]);
  return (
    <li className={`relative overflow-hidden rounded-[4px] bg-surface-2 ${small ? "h-12 w-16" : "h-20 w-24"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Remove photo" className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
          <X size={13} aria-hidden />
        </button>
      )}
    </li>
  );
}
