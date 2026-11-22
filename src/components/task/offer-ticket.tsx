"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  Clock,
  Globe2,
  MapPin,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { StartChat } from "@/components/chat/start-chat";
import { useI18n } from "@/components/providers";
import { rs } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";
import type { ReasonCode } from "@/lib/rules";
import type { Offer } from "./live-types";

/** Short text for one reason why an offer ranks where it does. */
function reasonText(r: ReasonCode, k: ReturnType<typeof useI18n>["t"]["task"], lang: "en" | "ne") {
  const n = (x: number, d = 1) => (lang === "ne" ? toDeva(x.toFixed(d)) : x.toFixed(d));
  switch (r.k) {
    case "rating":
      return k.reasons.rating(n(r.v));
    case "near":
      return k.reasons.near(n(r.v));
    case "jobs":
      return k.reasons.jobs(r.v);
    default:
      return k.reasons[r.k];
  }
}

/** A ticket-style card for one offer, with accept / counter-offer actions. */
export function OfferTicket({
  o,
  owner,
  open,
  onAct,
  taskId,
}: {
  o: Offer;
  owner: boolean;
  open: boolean;
  onAct: (id: string, b: Record<string, unknown>) => Promise<boolean>;
  taskId: string;
}) {
  const { t, lang } = useI18n();
  const k = t.task;
  const [why, setWhy] = useState(o.best);
  const [countering, setCountering] = useState(false);
  const counterMin = Math.max(100, Math.ceil(o.amount * 0.5));
  const [amount, setAmount] = useState(Math.max(counterMin, Math.floor((o.amount * 0.95) / 10) * 10));
  const [busy, setBusy] = useState(false);
  const closed = o.status !== "active";
  const run = async (b: Record<string, unknown>) => {
    setBusy(true);
    const ok = await onAct(o.id, b);
    setBusy(false);
    return ok;
  };

  return (
    <article
      className={`notch-frame ${closed && o.status !== "accepted" ? "opacity-60" : ""}`}
      aria-label={`${o.providerName}, ${rs(o.amount, lang)}`}
    >
      <div className="ticket">
        <div className="px-6 pt-5 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {o.best && open && (
                  <span className="bg-marigold text-ink inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-xs font-extrabold">
                    <Trophy size={12} aria-hidden /> {k.best}
                  </span>
                )}
                {o.isExample && <span className="demo-tag">{k.exampleOffer}</span>}
                {o.status === "accepted" && (
                  <span className="bg-accent text-accent-contrast rounded-[3px] px-2 py-0.5 text-xs font-bold">
                    {k.accepted}
                  </span>
                )}
                {o.status === "declined" && (
                  <span className="bg-surface-2 text-muted rounded-[3px] px-2 py-0.5 text-xs font-bold">
                    {k.declined}
                  </span>
                )}
              </div>
              <h3 className="font-display mt-1.5 text-lg font-bold">
                {o.profileHref ? (
                  <Link href={o.profileHref} className="hover:text-accent hover:underline">
                    {o.providerName}
                  </Link>
                ) : (
                  o.providerName
                )}
              </h3>
              <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {o.verified && (
                  <span className="stamp !text-[0.65rem]">
                    <BadgeCheck size={12} aria-hidden /> {t.browse.verified}
                  </span>
                )}
                {o.womenLed && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#8a3a1d] dark:text-[#f0b49c]">
                    <Users size={13} aria-hidden /> {t.browse.womenLed}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Star
                    size={14}
                    aria-hidden
                    className={o.ratingCount ? "fill-marigold text-marigold" : ""}
                  />
                  {o.ratingCount
                    ? lang === "ne"
                      ? toDeva(o.rating.toFixed(1))
                      : o.rating.toFixed(1)
                    : k.newProvider}
                </span>
                <span className="inline-flex items-center gap-1">
                  {o.distanceKm === null ? (
                    <Globe2 size={13} aria-hidden />
                  ) : (
                    <MapPin size={13} aria-hidden />
                  )}
                  {o.distanceKm === null ? t.browse.online : t.browse.km(o.distanceKm.toFixed(1))}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-extrabold">{rs(o.amount, lang)}</p>
              <p className="text-muted text-sm">
                <Clock size={13} aria-hidden className="mr-1 inline" />
                {k.daysShort(o.days)}
              </p>
            </div>
          </div>

          {o.message && (
            <p className="bg-surface-2 mt-3 rounded-[4px] p-3 text-[0.95rem] whitespace-pre-line">
              {o.message}
            </p>
          )}

          <button
            type="button"
            onClick={() => setWhy((w) => !w)}
            aria-expanded={why}
            className="text-accent mt-3 inline-flex items-center gap-1 text-sm font-semibold"
          >
            <ChevronDown
              size={15}
              aria-hidden
              className={`transition-transform ${why ? "rotate-180" : ""}`}
            />{" "}
            {k.why}
          </button>
          {why && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {o.reasons.map((r) => (
                <li key={r.k} className="border-line rounded-[3px] border px-2 py-0.5 text-xs font-semibold">
                  {reasonText(r, k, lang)}
                </li>
              ))}
              <li className="text-muted px-1 py-0.5 text-xs">score {o.score.toFixed(2)}</li>
            </ul>
          )}

          {o.counter && (
            <p
              className={`mt-3 text-sm font-semibold ${o.counter.status === "accepted" ? "text-accent" : o.counter.status === "declined" ? "text-danger" : "text-marigold-ink dark:text-marigold"}`}
            >
              {o.counter.status === "pending" &&
                (o.mine
                  ? k.counterFromClient(rs(o.counter.amount, lang))
                  : k.counterPending(rs(o.counter.amount, lang)))}
              {o.counter.status === "accepted" && k.counterAccepted(rs(o.counter.amount, lang))}
              {o.counter.status === "declined" && k.counterDeclined(rs(o.counter.amount, lang))}
            </p>
          )}

          {/* chat: client ↔ a real provider (example providers can't reply) */}
          {!o.isExample && (owner || o.mine) && (
            <div className="mt-3">
              <StartChat
                taskId={taskId}
                withUserId={owner ? o.providerId : undefined}
                label={t.msg.start}
                className="btn btn-quiet -ml-2 !min-h-9 text-sm"
              />
            </div>
          )}
        </div>

        {/* actions */}
        {open && !closed && (owner || (o.mine && o.counter?.status === "pending")) && (
          <>
            <div className="perforation mx-5" aria-hidden />
            <div className="flex flex-wrap items-center gap-2 px-6 pt-3 pb-5">
              {owner && (
                <>
                  {o.amount > counterMin && (!o.counter || o.counter.status === "declined") ? (
                    countering ? (
                      <form
                        className="flex flex-wrap items-center gap-2"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (await run({ action: "counter", amount })) setCountering(false);
                        }}
                      >
                        <label className="sr-only" htmlFor={`c-${o.id}`}>
                          {k.counter}
                        </label>
                        <input
                          id={`c-${o.id}`}
                          type="number"
                          min={counterMin}
                          max={o.amount - 1}
                          step={1}
                          value={amount}
                          onChange={(e) => setAmount(Number(e.target.value) || 0)}
                          className="input font-display !min-h-10 w-32 font-bold"
                        />
                        <button type="submit" className="btn btn-ghost !min-h-10" disabled={busy}>
                          {k.counterSend}
                        </button>
                        <p className="text-muted w-full text-xs">{k.counterLead(rs(o.amount, lang))}</p>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-ghost !min-h-10"
                        onClick={() => setCountering(true)}
                      >
                        {k.counter}
                      </button>
                    )
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary ml-auto !min-h-10"
                    disabled={busy}
                    onClick={() => {
                      const seen = o.amount;
                      if (window.confirm(k.acceptConfirm(o.providerName, rs(seen, lang))))
                        void run({ action: "accept", amount: seen });
                    }}
                  >
                    <CheckCircle2 size={16} aria-hidden /> {k.accept}
                  </button>
                </>
              )}
              {o.mine && o.counter?.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary !min-h-10"
                    disabled={busy}
                    onClick={() => void run({ action: "respond", accept: true })}
                  >
                    {k.acceptCounter}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost !min-h-10"
                    disabled={busy}
                    onClick={() => void run({ action: "respond", accept: false })}
                  >
                    {k.declineCounter}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
