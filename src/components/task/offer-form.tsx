"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Send, Sparkles } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { rs, rsRange } from "@/lib/format";
import type { Offer } from "./live-types";

/** Form where a provider sends, updates or withdraws their offer on a task. */
export function OfferForm({
  taskId,
  isProvider,
  idVerified,
  existing,
  fairLow,
  fairHigh,
  taskDays,
  budget,
  onDone,
  onWithdraw,
}: {
  taskId: string;
  isProvider: boolean;
  idVerified: boolean;
  existing?: Offer;
  fairLow: number;
  fairHigh: number;
  taskDays: number;
  budget: number | null;
  onDone: () => Promise<void>;
  onWithdraw?: () => Promise<boolean>;
}) {
  const { t, lang } = useI18n();
  const k = t.task;
  const mid = Math.round((fairLow + fairHigh) / 2 / 100) * 100;
  const [amount, setAmount] = useState(existing?.amount ?? budget ?? mid);
  const [days, setDays] = useState(existing?.days ?? taskDays);
  const [message, setMessage] = useState(existing?.message ?? "");
  const [busy, setBusy] = useState<"send" | "ai" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSent(false);
  }, [amount, days, message]);

  if (!isProvider) return <p className="bg-surface-2 rounded-[4px] p-4 text-sm">{k.switchProvider}</p>;
  if (!idVerified) {
    return (
      <p className="bg-surface-2 flex flex-wrap items-center gap-3 rounded-[4px] p-4 text-sm">
        {k.idNeeded}{" "}
        <Link href="/verification" className="btn btn-ghost !min-h-9">
          {k.verifyNow}
        </Link>
      </p>
    );
  }

  const draft = async () => {
    setBusy("ai");
    setErr(null);
    const r = await postJson<{ text: string }>("/api/ai/draft-proposal", { taskId, amount, days, lang });
    setBusy(null);
    if (r.ok && r.text) setMessage(r.text);
    else setErr(t.errors.generic);
  };

  const send = async (quick?: { amount: number; days: number; message: string }) => {
    setBusy("send");
    setErr(null);
    const r = await postJson(`/api/tasks/${taskId}/bids`, quick ?? { amount, days, message });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error && r.error in k.errors ? k.errors[r.error as keyof typeof k.errors] : t.errors.generic);
      return;
    }
    setSent(true);
    await onDone();
  };

  return (
    <section aria-labelledby="offer-h" className="notch-frame">
      <form
        className="notch-card terrace-edge space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <h2 id="offer-h" className="font-display text-xl font-bold">
          {existing ? k.yourOffer : k.makeOffer}
        </h2>
        {/* inDrive-style: accept the client's price in one tap, or raise it */}
        {budget !== null && !existing && (
          <div className="border-accent bg-accent-soft rounded-[12px] border-2 p-4">
            <p className="text-accent text-xs font-bold tracking-wider uppercase">{k.clientPrice}</p>
            <p className="font-display text-3xl font-extrabold">{rs(budget, lang)}</p>
            <button
              type="button"
              className="btn btn-primary mt-3 w-full sm:w-auto"
              disabled={busy !== null}
              onClick={() =>
                void send({ amount: budget, days: taskDays, message: k.acceptPriceMsg(taskDays) })
              }
            >
              <CheckCircle2 size={17} aria-hidden /> {k.acceptPrice(rs(budget, lang))}
            </button>
            <p className="text-muted mt-2 text-xs">{k.acceptPriceNote}</p>
            <p className="mt-4 text-sm font-semibold">{k.orOwn}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 10, 20].map((pct) => {
                const v = Math.round((budget * (1 + pct / 100)) / 50) * 50;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={`min-h-10 rounded-full border-[1.5px] px-4 text-sm font-bold ${amount === v ? "border-accent bg-surface text-accent" : "border-line-strong bg-surface"}`}
                  >
                    +{pct}% · {rs(v, lang)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">{k.amount}</span>
            <input
              type="number"
              min={100}
              step={50}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="input font-display text-lg font-bold"
            />
            <span className="field-hint">
              {t.task.fairRange}: {rsRange(fairLow, fairHigh, lang)}
            </span>
          </label>
          <label className="block">
            <span className="field-label">{k.offerDays}</span>
            <input
              type="number"
              min={1}
              max={90}
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className="input"
            />
          </label>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="offer-msg" className="field-label mb-0">
              {k.message}
            </label>
            <button
              type="button"
              className="btn btn-quiet !min-h-9 text-sm"
              onClick={() => void draft()}
              disabled={busy !== null}
            >
              <Sparkles size={15} aria-hidden /> {busy === "ai" ? t.post.drafting : k.draft}
            </button>
          </div>
          <textarea
            id="offer-msg"
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={k.messagePh}
            className="input mt-1.5 resize-y py-3"
          />
          <p className="field-hint">{k.draftNote}</p>
        </div>
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy !== null}>
            <Send size={16} aria-hidden /> {busy === "send" ? k.sending : existing ? k.updateOffer : k.send}
          </button>
          {sent && (
            <span role="status" className="text-accent text-sm font-semibold">
              <CheckCircle2 size={15} aria-hidden className="mr-1 inline" />✓
            </span>
          )}
          {existing && onWithdraw && (
            <button
              type="button"
              className="btn btn-quiet !text-danger ml-auto text-sm"
              onClick={() => void onWithdraw()}
            >
              {k.withdraw}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
