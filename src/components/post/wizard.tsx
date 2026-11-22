"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { TerraceSteps } from "@/components/terrace-steps";
import { ABROAD_COUNTRIES, areasFor } from "@/lib/geo";
import { fairRange, isCountable, type PriceOverrideLite } from "@/lib/pricing";
import { StepDescribe } from "./step-describe";
import { StepPrice } from "./step-price";
import { StepWhereWhen } from "./step-where-when";
import { TaskPreview } from "./task-preview";
import { usePostPayment } from "./post-payment";
import {
  CITIES,
  initialFields,
  todayIso,
  type Draft,
  type Source,
  type UpdateFields,
  type WizardFields,
} from "./wizard-state";

const LAST_STEP = 2;

/** Three-step "Post a task" form (what → where & when → price) with a live preview beside it. */
export function PostWizard({
  homeCity,
  homeArea,
  overrides = {},
}: {
  homeCity: string;
  homeArea?: string;
  overrides?: Record<string, PriceOverrideLite>;
}) {
  const { t, lang } = useI18n();
  const p = t.post;
  const router = useRouter();

  const [form, setForm] = useState<WizardFields>(() => initialFields(homeCity, homeArea));
  const update: UpdateFields = useCallback(
    (patch) => setForm((f) => ({ ...f, ...(typeof patch === "function" ? patch(f) : patch) })),
    [],
  );
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState<"ai" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<Source | null>(null);

  // Prefill from Home's task box or a provider profile ("Request a quote" / "Book").
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sk_draft");
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      const patch: Partial<WizardFields> = {};
      if (d.text) patch.text = d.text;
      if (d.task) {
        Object.assign(patch, {
          cat: d.task.category,
          title: d.task.title,
          details: d.task.details,
          days: d.task.days || 1,
          quantity: d.task.quantity || 1,
          online: !!d.task.online,
          source: d.source ?? "fallback",
        });
        setAiNote(d.source ?? "fallback");
      }
      if (d.city && CITIES.includes(d.city)) {
        patch.city = d.city;
        if (d.area) patch.area = d.area;
      }
      if (d.family && ABROAD_COUNTRIES.includes(d.family.country)) {
        Object.assign(patch, {
          familyOn: true,
          country: d.family.country,
          familyName: d.family.familyName ?? "",
        });
      }
      update(patch);
      setBanner(d.providerName ? p.fromProvider(d.providerName) : d.task ? p.fromHome : null);
    } catch {
      /* ignore bad drafts */
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- read the draft once, on mount

  // Keep the chosen area valid when the city changes.
  const areas = useMemo(() => areasFor(form.city), [form.city]);
  useEffect(() => {
    if (!areas.some((a) => a.name === form.area)) update({ area: areas[0]?.name ?? "" });
  }, [areas, form.area, update]);

  const { cat, days, quantity, city, online } = form;
  const range = useMemo(
    () => (cat ? fairRange({ category: cat, days, quantity, city, online, override: overrides[cat] }) : null),
    [cat, days, quantity, city, online, overrides],
  );

  /** Ask Claude (or the keyword fallback) to turn the free text into category, title, details and days. */
  const draftWithAi = async () => {
    if (form.text.trim().length < 4) {
      setErr(t.home.hero.tooShort);
      return;
    }
    setBusy("ai");
    setErr(null);
    const r = await postJson<{ source: Source; task: Draft["task"] & { quantity: number } }>(
      "/api/ai/parse-task",
      { text: form.text, lang, city: online ? undefined : city },
    );
    setBusy(null);
    if (!r.ok || !r.task) {
      setErr(r.error === "offline" ? t.errors.offline : t.errors.generic);
      return;
    }
    update({
      cat: r.task.category,
      title: r.task.title,
      details: r.task.details,
      days: r.task.days,
      quantity: r.task.quantity ?? 1,
      online: r.task.online,
      source: r.source,
    });
    setAiNote(r.source);
  };

  /** Returns an error message for the given step, or null when it is complete. */
  const validate = (s: number): string | null => {
    if (s === 0) {
      if (!form.cat) return p.errors.category;
      if (form.title.trim().length < 3) return p.errors.title;
    }
    if (s === 1) {
      if (!form.online && !form.area) return p.errors.area;
      if (!form.flexible && (!form.dueDate || form.dueDate < todayIso())) return p.errors.due_date;
    }
    if (s === 2 && form.budget !== null && form.budget < 100) return p.errors.budget;
    return null;
  };

  const go = (to: number) => {
    if (to > step) {
      const e = validate(step);
      if (e) {
        setErr(e);
        return;
      }
    }
    setErr(null);
    setStep(to);
    requestAnimationFrame(() => document.getElementById("wizard-h")?.focus());
  };

  const payment = usePostPayment({
    cardFirst: form.familyOn,
    onPosted: (id) => router.push(`/task/${id}`),
    submit: async (post) => {
      const f = form;
      const r = await postJson<{ id: string; ref?: string }>("/api/tasks", {
        category: f.cat,
        title: f.title.trim(),
        details: f.details.trim(),
        quantity: isCountable(f.cat as string) ? f.quantity : 1,
        days: f.days,
        city: f.online ? "Online" : f.city,
        area: f.online ? undefined : f.area,
        online: f.online,
        womenOnly: f.womenOnly,
        budget: f.budget,
        dueDate: f.flexible ? undefined : f.dueDate,
        flexible: f.flexible,
        family: f.familyOn ? { country: f.country, familyName: f.familyName.trim() } : undefined,
        aiSource: f.source,
        post,
      });
      if (!r.ok || !r.id) {
        const errors: Record<string, string> = { ...p.errors, ...t.market.post.errors };
        return { error: (r.error && errors[r.error]) || p.errors.generic };
      }
      if (f.photos.length) {
        const fd = new FormData();
        f.photos.forEach((b, i) => fd.append("photos", b, `photo-${i}.jpg`));
        await fetch(`/api/tasks/${r.id}/photos`, {
          method: "POST",
          body: fd,
          credentials: "same-origin",
        }).catch(() => null);
      }
      try {
        sessionStorage.removeItem("sk_draft");
      } catch {
        /* ignore */
      }
      return { id: r.id, ref: r.ref };
    },
  });

  const publish = () => {
    for (let s = 0; s <= LAST_STEP; s++) {
      const e = validate(s);
      if (e) {
        setErr(e);
        setStep(s);
        return;
      }
    }
    setErr(null);
    payment.open(form.title.trim());
  };

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        {banner && (
          <p className="bg-accent-soft text-accent mb-5 flex items-center gap-2 rounded-[4px] px-3 py-2 text-sm font-semibold">
            <Info size={16} aria-hidden /> {banner}
          </p>
        )}
        <TerraceSteps steps={p.steps} current={step} label={p.title} />
        <h2 id="wizard-h" tabIndex={-1} className="font-display text-2xl font-bold outline-none">
          {p.steps[step]}
        </h2>

        {step === 0 && (
          <StepDescribe
            form={form}
            update={update}
            busy={busy}
            aiNote={aiNote}
            onDraftWithAi={() => void draftWithAi()}
          />
        )}
        {step === 1 && <StepWhereWhen form={form} update={update} areas={areas} />}
        {step === 2 && (
          <>
            <StepPrice form={form} update={update} range={range} />
            <div className="mt-6">{payment.picker}</div>
          </>
        )}

        {err && (
          <p role="alert" className="field-error mt-5">
            {err}
          </p>
        )}
        <div className="border-line mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)}>
              <ArrowLeft size={17} aria-hidden /> {p.back}
            </button>
          )}
          {step < LAST_STEP ? (
            <button type="button" className="btn btn-primary ml-auto" onClick={() => go(step + 1)}>
              {p.next} <ArrowRight size={17} aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary ml-auto"
              onClick={publish}
              disabled={busy !== null}
            >
              {payment.payLabel}
            </button>
          )}
        </div>
      </div>

      <TaskPreview form={form} range={range} />
      {payment.sheet}
    </div>
  );
}
