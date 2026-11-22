"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { EXAMPLE_FX, JOB_COUNTRIES, type JobCountry } from "@/lib/geo";
import { CATEGORIES, type CategoryId } from "@/lib/pricing";
import { num, rs } from "@/lib/format";

export function PostJobForm() {
  const { t, lang } = useI18n();
  const j = t.abroadJobs;
  const f = j.form;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState<CategoryId | "">("");
  const [country, setCountry] = useState<JobCountry>("Qatar");
  const [city, setCity] = useState("");
  const [workers, setWorkers] = useState("1");
  const [days, setDays] = useState("30");
  const [pay, setPay] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const total = (Number(pay) || 0) * (Number(workers) || 0);
  const fx = EXAMPLE_FX[country];

  const whole = (v: string, min: number, max: number) =>
    Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max;
  const problem = () => {
    if (title.trim().length < 3) return j.errors.title;
    if (!cat) return j.errors.category;
    if (city.trim().length < 2) return j.errors.city;
    if (!whole(workers, 1, 50)) return j.errors.workers;
    if (!whole(days, 1, 60)) return j.errors.days;
    if (!whole(pay, 1000, 1_000_000)) return j.errors.pay;
    return null;
  };

  const submit = async () => {
    const p = problem();
    setErr(p);
    if (p) return;
    setBusy(true);
    const r = await postJson<{ id: string }>("/api/abroad/jobs", {
      title,
      category: cat,
      country,
      city,
      details,
      workersNeeded: Number(workers),
      days: Number(days),
      payPerWorker: Number(pay),
    });
    if (r.ok && r.id) return router.push(`/abroad/jobs/${r.id}`);
    setBusy(false);
    setErr(r.error && r.error in j.errors ? j.errors[r.error as keyof typeof j.errors] : t.errors.generic);
  };

  return (
    <form
      noValidate
      className="grid gap-8 lg:grid-cols-[1fr_20rem]"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="grid content-start gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="field-label">{f.jobTitle}</span>
          <input
            name="title"
            className="input"
            maxLength={80}
            placeholder={f.jobTitlePh}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">{f.category}</span>
          <select
            name="category"
            className="input"
            value={cat}
            onChange={(e) => setCat(e.target.value as CategoryId)}
          >
            <option value="" disabled>
              —
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "ne" ? c.ne : c.en}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">{f.country}</span>
          <select
            name="country"
            className="input"
            value={country}
            onChange={(e) => setCountry(e.target.value as JobCountry)}
          >
            {JOB_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {j.countries[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">{f.city}</span>
          <input
            name="city"
            className="input"
            maxLength={60}
            placeholder={f.cityPh}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">{f.workers}</span>
          <input
            name="workers"
            className="input"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={workers}
            onChange={(e) => setWorkers(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">{f.days}</span>
          <input
            name="days"
            className="input"
            type="number"
            min={1}
            max={60}
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">{f.pay}</span>
          <input
            name="pay"
            className="input font-display text-lg font-bold"
            type="number"
            min={1000}
            max={1000000}
            inputMode="numeric"
            value={pay}
            onChange={(e) => setPay(e.target.value)}
          />
          {fx && Number(pay) > 0 && (
            <span className="field-hint block">
              {j.approx(fx.code, num(Math.max(1, Math.round(Number(pay) / fx.nprPer)), lang))} · {j.rateNote}
            </span>
          )}
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">{f.details}</span>
          <textarea
            name="details"
            className="input resize-y py-3"
            rows={4}
            maxLength={2000}
            placeholder={f.detailsPh}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
      </div>

      <aside className="border-line bg-surface h-fit space-y-4 rounded-[14px] border p-5">
        <div>
          <p className="text-muted text-sm">{f.total}</p>
          <p className="font-display text-3xl font-extrabold">{total > 0 ? rs(total, lang) : "—"}</p>
        </div>
        <p className="flex gap-2 text-sm">
          <CreditCard size={18} aria-hidden className="text-accent shrink-0" /> {f.payLater}
        </p>
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full" disabled={busy}>
          {busy ? f.busy : f.submit}
        </button>
        <p className="text-muted text-xs">{j.legal}</p>
      </aside>
    </form>
  );
}
