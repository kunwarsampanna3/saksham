"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { postJson, useI18n, useUser } from "@/components/providers";
import type { PublicUser } from "@/lib/store/types";

/** DEMO only: the whole "hire abroad" flow, one click per step, switching between example accounts. */
export function DemoGuide({
  mpin,
  jobs,
}: {
  mpin: string;
  jobs: Record<"villa" | "driver" | "cleaning", string>;
}) {
  const { t } = useI18n();
  const g = t.abroadJobs.guide;
  const { setUser } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const job = (id: string) => `/abroad/jobs/${id}`;
  // Same order as guide.steps in the dictionary.
  const go = [
    { persona: "suman", name: "Suman", href: "/abroad/jobs/new" },
    { persona: "hari", name: "Hari", href: job(jobs.driver) },
    { persona: "suman", name: "Suman", href: job(jobs.villa) },
    { persona: "gita", name: "Gita", href: job(jobs.villa) },
    { persona: "suman", name: "Suman", href: job(jobs.cleaning) },
    { persona: "suman", name: "Suman", href: "/profile/me" },
    { persona: "hari", name: "Hari", href: "/profile/me" },
  ];

  const open = async (persona: string, href: string) => {
    setBusy(true);
    setErr(false);
    const r = await postJson<{ user: PublicUser }>("/api/auth/demo", { persona });
    setBusy(false);
    if (!r.ok) return setErr(true);
    setUser(r.user);
    router.push(href);
    router.refresh();
  };

  return (
    <section
      aria-labelledby="guide-h"
      className="border-line-strong bg-surface rounded-[14px] border border-dashed p-5"
    >
      <h2 id="guide-h" className="font-display text-xl font-bold">
        {g.title} <span className="demo-tag align-middle">{t.common.demo}</span>
      </h2>
      <p className="text-muted mt-1 text-sm">
        {g.lead} {g.mpin(mpin)}
      </p>
      <ol className="divide-line mt-3 divide-y">
        {g.steps.map((s, i) => (
          <li key={s.t} className="flex flex-wrap items-center gap-3 py-3">
            <span className="bg-accent-soft text-accent grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold">
              {i + 1}
            </span>
            <span className="min-w-[12rem] flex-1">
              <span className="block font-semibold">{s.t}</span>
              <span className="text-muted block text-sm">{s.b}</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost !min-h-10"
              disabled={busy}
              onClick={() => void open(go[i].persona, go[i].href)}
            >
              {g.as(go[i].name)} <ArrowRight size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <p className="text-muted mt-2 text-xs">{g.reset}</p>
      {err && (
        <p role="alert" className="field-error">
          {t.errors.generic}
        </p>
      )}
    </section>
  );
}
