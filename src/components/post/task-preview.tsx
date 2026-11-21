"use client";

import { CalendarDays, Globe2, MapPin, Plane, Users } from "lucide-react";
import { useI18n } from "@/components/providers";
import { rs, rsRange } from "@/lib/format";
import { category, isCountable } from "@/lib/pricing";
import { PhotoThumb } from "./photo-thumb";
import type { FairRange } from "./step-price";
import type { WizardFields } from "./wizard-state";

/** Live preview of how the task card will look once posted. */
export function TaskPreview({ form, range }: { form: WizardFields; range: FairRange | null }) {
  const { t, lang } = useI18n();
  const p = t.post;
  const {
    cat,
    title,
    details,
    online,
    area,
    city,
    flexible,
    dueDate,
    quantity,
    womenOnly,
    familyOn,
    country,
  } = form;

  return (
    <aside className="lg:col-span-5" aria-label={p.preview}>
      <div className="lg:sticky lg:top-[calc(var(--header-h)+16px)]">
        <p className="text-muted mb-2 text-xs font-semibold tracking-wider uppercase">{p.preview}</p>
        <div className="notch-frame">
          <div className="ticket">
            <div className="px-6 pt-5 pb-4">
              {cat ? (
                <p className="text-accent text-sm font-semibold">
                  {lang === "ne" ? category(cat).ne : category(cat).en}
                </p>
              ) : null}
              <h3 className="font-display mt-1 text-xl leading-snug font-bold">
                {title || <span className="text-muted">{p.previewEmpty}</span>}
              </h3>
              {details && (
                <p className="text-muted mt-2 line-clamp-4 text-[0.95rem] whitespace-pre-line">{details}</p>
              )}
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <li className="inline-flex items-center gap-1">
                  {online ? <Globe2 size={14} aria-hidden /> : <MapPin size={14} aria-hidden />}{" "}
                  {online ? t.browse.online : `${area ? `${area}, ` : ""}${city}`}
                </li>
                <li className="inline-flex items-center gap-1">
                  <CalendarDays size={14} aria-hidden /> {flexible ? p.flexible : dueDate || "—"}
                </li>
                {cat && isCountable(cat) && quantity > 1 && <li>× {quantity}</li>}
                {womenOnly && (
                  <li className="inline-flex items-center gap-1 font-semibold text-[#8a3a1d] dark:text-[#f0b49c]">
                    <Users size={14} aria-hidden /> {p.womenOnly}
                  </li>
                )}
                {familyOn && (
                  <li className="inline-flex items-center gap-1">
                    <Plane size={14} aria-hidden /> {country}
                  </li>
                )}
              </ul>
              {form.photos.length > 0 && (
                <ul className="mt-3 flex gap-1.5">
                  {form.photos.map((b, i) => (
                    <PhotoThumb key={i} blob={b} small />
                  ))}
                </ul>
              )}
            </div>
            <div className="perforation mx-5" aria-hidden />
            <div className="flex items-end justify-between px-6 pt-3 pb-5">
              <div>
                <p className="text-muted text-xs font-semibold tracking-wider uppercase">{p.fairRange}</p>
                <p className="font-display text-lg font-extrabold">
                  {range ? rsRange(range.low, range.high, lang) : "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-muted text-xs font-semibold tracking-wider uppercase">{p.yourBudget}</p>
                <p className="font-display text-accent text-lg font-extrabold">
                  {form.budget !== null ? rs(form.budget, lang) : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
