"use client";

import { ImagePlus, Sparkles, Zap } from "lucide-react";
import { useI18n } from "@/components/providers";
import { shrinkImage } from "@/components/verify/photo-input";
import { CATEGORIES, isCountable, type CategoryId } from "@/lib/pricing";
import { PhotoThumb } from "./photo-thumb";
import type { Source, UpdateFields, WizardFields } from "./wizard-state";

const MAX_PHOTOS = 4;

/** Step 1: describe the task (optionally drafted by AI), pick a category, add photos. */
export function StepDescribe({
  form,
  update,
  busy,
  aiNote,
  onDraftWithAi,
}: {
  form: WizardFields;
  update: UpdateFields;
  busy: "ai" | "post" | null;
  aiNote: Source | null;
  onDraftWithAi: () => void;
}) {
  const { t, lang } = useI18n();
  const p = t.post;
  const { text, cat, quantity, days, title, details, photos } = form;

  return (
    <div className="mt-5 space-y-5">
      <div>
        <label htmlFor="w-text" className="field-label">
          {p.describe}
        </label>
        <textarea
          id="w-text"
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder={p.describePh}
          className="input resize-y py-3"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-ghost" onClick={onDraftWithAi} disabled={busy !== null}>
            <Sparkles size={17} aria-hidden /> {busy === "ai" ? p.drafting : p.draftAi}
          </button>
          {aiNote && (
            <span
              role="status"
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${aiNote === "ai" ? "text-accent" : "text-muted"}`}
            >
              {aiNote === "ai" ? <Sparkles size={14} aria-hidden /> : <Zap size={14} aria-hidden />}{" "}
              {aiNote === "ai" ? p.aiDone : p.aiFallback}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">{p.category}</span>
          <select
            className="input"
            value={cat}
            // Picking a category by hand means the details are no longer purely AI-made.
            onChange={(e) => update({ cat: e.target.value as CategoryId, source: "manual" })}
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
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">{p.quantity}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={500}
              inputMode="numeric"
              value={quantity}
              disabled={!cat || !isCountable(cat)}
              onChange={(e) => update({ quantity: Math.min(500, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </label>
          <label className="block">
            <span className="field-label">{p.days}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={60}
              inputMode="numeric"
              value={days}
              onChange={(e) => update({ days: Math.min(60, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </label>
        </div>
      </div>
      <label className="block">
        <span className="field-label">{p.taskTitle}</span>
        <input
          className="input"
          maxLength={80}
          value={title}
          onChange={(e) => update({ title: e.target.value })}
        />
      </label>
      <label className="block">
        <span className="field-label">{p.details}</span>
        <textarea
          className="input resize-y py-3"
          rows={4}
          maxLength={2000}
          value={details}
          placeholder={p.detailsPh}
          onChange={(e) => update({ details: e.target.value })}
        />
      </label>

      <div>
        <span className="field-label">{p.photos}</span>
        <ul className="flex flex-wrap gap-2">
          {photos.map((b, i) => (
            <PhotoThumb
              key={i}
              blob={b}
              onRemove={() => update((f) => ({ photos: f.photos.filter((_, j) => j !== i) }))}
            />
          ))}
          {photos.length < MAX_PHOTOS && (
            <li>
              <label className="border-line-strong text-muted hover:border-accent hover:text-accent flex h-20 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-[4px] border-[1.5px] border-dashed text-xs font-semibold">
                <ImagePlus size={20} aria-hidden /> {p.addPhoto}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={async (e) => {
                    const files = [...(e.target.files ?? [])].slice(0, MAX_PHOTOS - photos.length);
                    e.target.value = "";
                    const shrunk = await Promise.all(files.map((f) => shrinkImage(f, 1600)));
                    update((f) => ({ photos: [...f.photos, ...shrunk].slice(0, MAX_PHOTOS) }));
                  }}
                />
              </label>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
