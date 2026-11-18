"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/components/providers";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  const s = t.status;
  useEffect(() => { console.error(error); }, [error]);
  return (
    <section role="alert" className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <h1 className="font-display text-4xl font-extrabold">{s.error}</h1>
      <p className="mt-3 text-lg text-muted">{s.errorLead}</p>
      {error.digest && <p className="mt-2 text-sm text-muted">{s.ref}: <code>{error.digest}</code></p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={reset}>{s.retry}</button>
        <Link href="/" className="btn btn-ghost">{s.home}</Link>
      </div>
    </section>
  );
}
