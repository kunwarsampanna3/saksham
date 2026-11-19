"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Laptop, Scissors, Plane, ChevronRight } from "lucide-react";
import { postJson, useI18n, useUser } from "@/components/providers";
import type { PublicUser } from "@/lib/store/types";
import { safeNext } from "./login-form";

/** Rendered only when the server says DEMO_MODE=true. Removed entirely in production. */
export function DemoPanel({ mpin, next }: { mpin: string; next?: string }) {
  const { t } = useI18n();
  const { setUser } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const people = [
    { key: "mina", name: "Mina Shrestha", sub: t.demo.mina, Icon: Store },
    { key: "bikash", name: "Bikash Tamang", sub: t.demo.bikash, Icon: Laptop },
    { key: "aasha", name: "Aasha's Tailoring Group", sub: t.demo.aasha, Icon: Scissors },
    { key: "suman", name: "Suman Gurung", sub: t.demo.suman, Icon: Plane },
  ] as const;

  const go = async (persona: string) => {
    setBusy(persona); setErr(null);
    const r = await postJson<{ user: PublicUser }>("/api/auth/demo", { persona });
    setBusy(null);
    if (!r.ok) return setErr(t.errors.generic);
    setUser(r.user);
    router.replace(safeNext(next));
    router.refresh();
  };

  return (
    <section aria-labelledby="demo-title" className="mt-6 rounded-md border border-dashed border-line-strong bg-surface/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="demo-title" className="font-display text-lg font-bold">{t.demo.title}</h2>
        <span className="demo-tag">{t.common.demo}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{t.demo.body}</p>
      <ul className="mt-3 grid gap-2">
        {people.map(({ key, name, sub, Icon }) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => void go(key)}
              disabled={busy !== null}
              className="group flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent focus-visible:border-accent disabled:opacity-60"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-tight">{name}</span>
                <span className="block truncate text-sm text-muted">{sub}</span>
              </span>
              <span className="hidden text-xs font-semibold uppercase tracking-wide text-muted xs:inline">{t.common.exampleAccount}</span>
              <ChevronRight size={18} aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5" />
              {busy === key && <span className="sr-only">{t.common.loading}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{t.demo.mpinNote(mpin)}</p>
      {err && <p role="alert" className="field-error">{err}</p>}
    </section>
  );
}
