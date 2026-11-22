"use client";

import { Globe2, Plane } from "lucide-react";
import { useI18n } from "@/components/providers";
import { ABROAD_COUNTRIES, type areasFor } from "@/lib/geo";
import { CITIES, todayIso, type AbroadCountry, type UpdateFields, type WizardFields } from "./wizard-state";

/** Step 2: online or in a city and area, when it is needed, and whether family abroad is paying. */
export function StepWhereWhen({
  form,
  update,
  areas,
}: {
  form: WizardFields;
  update: UpdateFields;
  areas: ReturnType<typeof areasFor>;
}) {
  const { t, lang } = useI18n();
  const p = t.post;
  const { online, city, area, flexible, dueDate, familyOn, country, familyName } = form;

  return (
    <div className="mt-5 space-y-6">
      <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
        <input
          type="checkbox"
          checked={online}
          onChange={(e) => update({ online: e.target.checked })}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <Globe2 size={17} aria-hidden className="text-accent" /> {p.online}
      </label>
      {!online && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">{p.city}</span>
            <select className="input" value={city} onChange={(e) => update({ city: e.target.value })}>
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="field-label">{p.area}</span>
            <select className="input" value={area} onChange={(e) => update({ area: e.target.value })}>
              {areas.map((a) => (
                <option key={a.name} value={a.name}>
                  {lang === "ne" ? a.ne : a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <fieldset>
        <legend className="field-label">{p.when}</legend>
        <div className="flex flex-wrap gap-2">
          {[true, false].map((f) => (
            <label
              key={String(f)}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 font-semibold ${flexible === f ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}
            >
              <input
                type="radio"
                name="when"
                checked={flexible === f}
                onChange={() => update({ flexible: f })}
                className="accent-[var(--accent)]"
              />{" "}
              {f ? p.flexible : p.byDate}
            </label>
          ))}
        </div>
        {!flexible && (
          <label className="mt-3 block max-w-xs">
            <span className="field-label">{p.date}</span>
            <input
              type="date"
              className="input"
              min={todayIso()}
              value={dueDate}
              onChange={(e) => update({ dueDate: e.target.value })}
            />
          </label>
        )}
      </fieldset>
      <div className="border-line rounded-[4px] border p-4">
        <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
          <input
            type="checkbox"
            checked={familyOn}
            onChange={(e) => update({ familyOn: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <Plane size={17} aria-hidden className="text-accent" /> {p.family}
        </label>
        {familyOn && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">{p.country}</span>
              <select
                className="input"
                value={country}
                onChange={(e) => update({ country: e.target.value as AbroadCountry })}
              >
                {ABROAD_COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">{p.familyName}</span>
              <input
                className="input"
                maxLength={60}
                value={familyName}
                onChange={(e) => update({ familyName: e.target.value })}
              />
            </label>
            <p className="text-muted text-sm sm:col-span-2">{p.familyNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
