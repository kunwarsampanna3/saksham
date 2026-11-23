"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe2, Pencil } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { CATEGORIES, category, type CategoryId } from "@/lib/pricing";
import { num } from "@/lib/format";

/** "My skills": each skill as a card with its open jobs, and a picker to change them. */
export function SkillsEditor({
  skills,
  openJobs,
  needsOne,
}: {
  skills: CategoryId[];
  openJobs: Record<string, number>;
  needsOne: boolean;
}) {
  const { t, lang } = useI18n();
  const m = t.me;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<CategoryId[]>(skills);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggle = (id: CategoryId) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = async () => {
    if (needsOne && picked.length === 0) return setErr(m.needOne);
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/profile", { categories: picked });
    setBusy(false);
    if (!r.ok) return setErr(r.error === "categories_required" ? m.needOne : t.errors.generic);
    setEditing(false);
    setSaved(true);
    router.refresh();
  };

  return (
    <section aria-labelledby="skills-h" className="border-line bg-surface rounded-[14px] border p-5 sm:p-6" data-skills>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="skills-h" className="font-display text-2xl font-bold">
            {m.skills}{" "}
            {skills.length > 0 && (
              <span className="text-muted text-base font-semibold">· {m.skillCount(num(skills.length, lang))}</span>
            )}
          </h2>
          <p className="text-muted">{m.skillsLead}</p>
        </div>
        {!editing && (
          <button
            type="button"
            className="btn btn-ghost !min-h-10"
            onClick={() => {
              setPicked(skills);
              setSaved(false);
              setEditing(true);
            }}
          >
            <Pencil size={16} aria-hidden /> {skills.length ? m.edit : m.add}
          </button>
        )}
      </div>
      {saved && (
        <p role="status" className="text-accent mt-2 font-semibold">
          {m.saved}
        </p>
      )}

      {editing ? (
        <div className="mt-4">
          <p className="field-label">{m.pick}</p>
          <ul className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.id !== "other").map((c) => {
              const on = picked.includes(c.id);
              const Icon = CATEGORY_ICONS[c.id];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-3.5 text-sm font-semibold ${on ? "border-accent bg-accent text-accent-contrast" : "border-line-strong hover:border-accent"}`}
                  >
                    {on ? <Check size={16} aria-hidden /> : <Icon size={16} aria-hidden />}
                    {lang === "ne" ? c.ne : c.en}
                  </button>
                </li>
              );
            })}
          </ul>
          {err && (
            <p role="alert" className="field-error mt-3">
              {err}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save()}>
              {m.save}
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                setEditing(false);
                setErr(null);
              }}
            >
              {m.cancel}
            </button>
          </div>
        </div>
      ) : skills.length === 0 ? (
        <p className="border-line-strong text-muted mt-4 rounded-[10px] border border-dashed p-5">{m.none}</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {skills.map((id) => {
            const c = category(id);
            const Icon = CATEGORY_ICONS[id];
            const jobs = openJobs[id] ?? 0;
            return (
              <li key={id} data-skill={id} className="border-line bg-bg rounded-[12px] border p-4">
                <div className="flex items-center gap-3">
                  <span className="bg-accent-soft text-accent grid h-11 w-11 shrink-0 place-items-center rounded-[10px]">
                    <Icon size={22} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-lg leading-tight font-bold">{lang === "ne" ? c.ne : c.en}</p>
                    {c.online && (
                      <p className="text-muted inline-flex items-center gap-1 text-xs">
                        <Globe2 size={12} aria-hidden /> {m.online}
                      </p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/explore?category=${id}`}
                  className="text-accent mt-3 inline-block text-sm font-semibold hover:underline"
                >
                  {jobs ? m.openJobs(num(jobs, lang)) : m.noJobs}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
