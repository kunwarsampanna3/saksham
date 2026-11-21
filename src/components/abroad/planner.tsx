"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { category, type CategoryId, type FairRange } from "@/lib/pricing";
import { ABROAD_COUNTRIES, CITY_COORDS, EXAMPLE_FX, areasFor } from "@/lib/geo";
import { num, rsRange } from "@/lib/format";

type Country = (typeof ABROAD_COUNTRIES)[number];
type Relation = "mother" | "father" | "parents" | "spouse" | "child" | "sibling" | "other";
interface Parsed {
  category: CategoryId;
  title: string;
  details: string;
  days: number;
  quantity?: number;
  online: boolean;
}

const CITIES = Object.keys(CITY_COORDS);
const RELATIONS: Relation[] = ["parents", "mother", "father", "spouse", "child", "sibling", "other"];

/** Estimate a job for family in Nepal, then hand off to the normal post wizard with the family fields prefilled. */
export function AbroadPlanner({ homeCity }: { homeCity: string }) {
  const { t, lang } = useI18n();
  const a = t.abroad2;
  const router = useRouter();
  const [country, setCountry] = useState<Country>("Qatar");
  const [relation, setRelation] = useState<Relation>("parents");
  const [familyName, setFamilyName] = useState("");
  const [city, setCity] = useState(CITIES.includes(homeCity) ? homeCity : "Kathmandu");
  const areas = useMemo(() => areasFor(city), [city]);
  const [area, setArea] = useState(areas[0]?.name ?? "");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<{ task: Parsed; range: FairRange; source: "ai" | "fallback" } | null>(null);

  const fx = EXAMPLE_FX[country];
  const local = (n: number) => (fx ? num(Math.max(1, Math.round(n / fx.nprPer)), lang) : "");

  const estimate = async () => {
    if (text.trim().length < 4) {
      setErr(t.home.hero.tooShort);
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await postJson<{ task: Parsed; range: FairRange; source: "ai" | "fallback" }>(
      "/api/ai/parse-task",
      { text, lang, city },
    );
    setBusy(false);
    if (!r.ok || !r.task || !r.range) {
      setErr(r.error === "offline" ? t.errors.offline : t.errors.generic);
      return;
    }
    setRes({ task: r.task, range: r.range, source: r.source ?? "fallback" });
  };

  const goPost = () => {
    if (!res) return;
    const name = familyName.trim() || a.relations[relation];
    try {
      sessionStorage.setItem(
        "sk_draft",
        JSON.stringify({
          text,
          task: res.task,
          source: res.source,
          city,
          area,
          family: { country, familyName: name },
          at: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
    router.push("/post");
  };

  return (
    <section aria-label={a.title} className="notch-frame">
      <div className="notch-card terrace-edge space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">{a.country}</span>
            <select className="input" value={country} onChange={(e) => setCountry(e.target.value as Country)}>
              {ABROAD_COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">{a.relation}</span>
            <select
              className="input"
              value={relation}
              onChange={(e) => setRelation(e.target.value as Relation)}
            >
              {RELATIONS.map((r) => (
                <option key={r} value={r}>
                  {a.relations[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="field-label">{a.familyName}</span>
            <input
              className="input"
              maxLength={60}
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="field-label">{a.where}</span>
            <select
              className="input"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setArea(areasFor(e.target.value)[0]?.name ?? "");
              }}
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">{t.post.area}</span>
            <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
              {areas.map((x) => (
                <option key={x.name} value={x.name}>
                  {lang === "ne" ? x.ne : x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="field-label">{a.what}</span>
          <textarea
            className="input resize-y py-3"
            rows={3}
            maxLength={1000}
            value={text}
            placeholder={a.whatPh}
            onChange={(e) => {
              setText(e.target.value);
              setRes(null);
            }}
          />
        </label>
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        <button type="button" className="btn btn-primary" onClick={() => void estimate()} disabled={busy}>
          <Sparkles size={18} aria-hidden /> {busy ? a.estimating : a.estimate}
        </button>

        {res && (
          <div aria-live="polite" className="border-line bg-surface-2 rounded-[4px] border p-5">
            <p className="text-muted text-sm">
              {lang === "ne" ? category(res.task.category).ne : category(res.task.category).en} ·{" "}
              {res.task.title}
            </p>
            <p className="text-muted mt-2 text-xs font-semibold tracking-wider uppercase">{a.fair}</p>
            <p className="font-display text-3xl font-extrabold">
              {rsRange(res.range.low, res.range.high, lang)}
            </p>
            {fx && (
              <p className="mt-1 text-lg font-semibold">
                {a.approx(fx.code, `${local(res.range.low)}–${local(res.range.high)}`)}
              </p>
            )}
            <p className="text-muted mt-2 text-sm">
              <span className="demo-tag mr-2">Example</span>
              {a.rateNote}
            </p>
            <p className="text-muted mt-1 text-xs">
              {res.source === "ai" ? t.post.aiDone : t.post.aiFallback}
            </p>
            <button type="button" className="btn btn-primary mt-4" onClick={goPost}>
              {a.continue} <ArrowRight size={18} aria-hidden />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
