"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";

/** Client rates the provider after the job is complete. Real ratings feed the provider's Earnings Passport. */
export function RateBox({ bookingId, providerName, rated }: { bookingId: string; providerName: string; rated: { stars: number; text: string } | null }) {
  const { t } = useI18n();
  const r = t.rate;
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (rated) {
    return (
      <section className="rounded-[4px] border border-line p-5" aria-label={r.title}>
        <p className="font-semibold">{r.thanks}</p>
        <p className="mt-1 inline-flex gap-0.5" aria-label={`${rated.stars} / 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={18} aria-hidden className={i < rated.stars ? "fill-marigold text-marigold" : "text-line-strong"} />)}</p>
        {rated.text && <p className="mt-1 text-muted">{rated.text}</p>}
      </section>
    );
  }

  return (
    <section className="notch-frame" aria-labelledby="rate-h">
      <form className="notch-card terrace-edge space-y-3 p-5" onSubmit={async (e) => {
        e.preventDefault();
        if (!stars) return setErr(r.pick);
        setBusy(true); setErr(null);
        const res = await postJson(`/api/bookings/${bookingId}/rate`, { stars, text });
        setBusy(false);
        if (res.ok) router.refresh(); else setErr(t.errors.generic);
      }}>
        <h2 id="rate-h" className="font-display text-xl font-bold">{r.title}</h2>
        <p className="text-sm text-muted">{r.lead(providerName)}</p>
        <fieldset>
          <legend className="sr-only">{r.title}</legend>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
                <input type="radio" name="stars" value={n} checked={stars === n} onChange={() => setStars(n)} className="peer sr-only" />
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--focus)]">
                  <Star size={28} aria-hidden className={(hover || stars) >= n ? "fill-marigold text-marigold" : "text-line-strong"} />
                </span>
                <span className="sr-only">{n} / 5</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block"><span className="field-label">{r.comment} <span className="font-normal text-muted">({t.common.optional})</span></span>
          <textarea className="input resize-y py-2" rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} /></label>
        <p className="text-xs text-muted">{r.honest}</p>
        {err && <p role="alert" className="field-error">{err}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{r.submit}</button>
      </form>
    </section>
  );
}
