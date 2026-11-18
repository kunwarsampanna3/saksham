"use client";

import { useState } from "react";
import { Check, Copy, Link2, Plane, X } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { npDate } from "@/lib/format";

interface Confirmation { installmentId: string; ok: boolean; note: string; at: string }

/** Client-only panel on the payment page for a hire-from-abroad booking. */
export function FamilyPanel({ bookingId, familyName, confirmations, labels }: {
  bookingId: string; familyName: string;
  confirmations: Confirmation[]; labels: Record<string, string>;
}) {
  const { t, lang } = useI18n();
  const a = t.abroad2;
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const make = async () => {
    setBusy(true); setErr(null); setCopied(false);
    const r = await postJson<{ url: string }>(`/api/bookings/${bookingId}/family`, { action: "link" });
    setBusy(false);
    if (r.ok && r.url) setUrl(r.url); else setErr(t.errors.generic);
  };
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* user can select the text */ }
  };

  return (
    <section aria-labelledby="family-h" className="rounded-[4px] border border-line bg-surface p-6">
      <h2 id="family-h" className="font-display flex items-center gap-2 text-xl font-bold"><Plane size={20} aria-hidden /> {a.confirmTitle}</h2>
      <p className="mt-1 text-muted">{a.confirmLead(familyName)}</p>
      {url ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input readOnly className="input font-mono text-sm" value={url} aria-label={a.confirmTitle} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="btn btn-primary shrink-0" onClick={() => void copy()}>{copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />} {copied ? a.copied : a.copy}</button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary mt-4" onClick={() => void make()} disabled={busy}><Link2 size={18} aria-hidden /> {a.newLink}</button>
      )}
      {err && <p role="alert" className="field-error mt-2">{err}</p>}
      <p className="mt-2 text-sm text-muted">{a.linkNote}</p>

      <h3 className="mt-5 font-semibold">{a.confirmations}</h3>
      {confirmations.length === 0 ? <p className="text-sm text-muted">{a.none}</p> : (
        <ul className="mt-2 space-y-2">
          {confirmations.map((c) => (
            <li key={c.installmentId} className="text-sm">
              <span className={`inline-flex items-center gap-1 font-semibold ${c.ok ? "text-accent" : "text-danger"}`}>{c.ok ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />} {c.ok ? a.ok : a.notOk}</span>
              <span className="text-muted"> · {labels[c.installmentId]} · {npDate(c.at, lang)}</span>
              {c.note && <q className="mt-0.5 block text-muted">{c.note}</q>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
