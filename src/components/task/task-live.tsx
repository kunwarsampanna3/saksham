"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { rs } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";
import type { Live } from "./live-types";
import { OfferForm } from "./offer-form";
import { OfferTicket } from "./offer-ticket";
import { QAPanel } from "./qa-panel";

export type { Live, Offer, QA } from "./live-types";

/** The live part of a task page: offers, the provider's offer form and Q&A, refreshed every 5 s. */
export function TaskLive({
  taskId,
  initial,
  isProvider,
  idVerified,
  fairLow,
  fairHigh,
  taskDays,
  budget = null,
  scheduleHref,
}: {
  taskId: string;
  initial: Live;
  isProvider: boolean;
  idVerified: boolean;
  fairLow: number;
  fairHigh: number;
  taskDays: number;
  budget?: number | null;
  scheduleHref: string | null;
}) {
  const { t, lang } = useI18n();
  const k = t.task;
  const router = useRouter();
  const [live, setLive] = useState<Live>(initial);
  const [err, setErr] = useState<string | null>(null);
  const errText = (e?: string) =>
    e && e in k.errors
      ? k.errors[e as keyof typeof k.errors]
      : e === "offline"
        ? t.errors.offline
        : t.errors.generic;

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/tasks/${taskId}/live`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    if (r?.ok) setLive(r);
  }, [taskId]);

  // Poll every 5 s while the tab is visible — new offers, counters and answers appear without reloading.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer)
        timer = setInterval(() => {
          if (document.visibilityState === "visible") void refresh();
        }, 5000);
    };
    start();
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const act = async (bidId: string, body: Record<string, unknown>) => {
    setErr(null);
    const r = await postJson<{ next?: string }>(`/api/tasks/${taskId}/bids/${bidId}`, body);
    if (!r.ok) {
      setErr(errText(r.error));
      return false;
    }
    await refresh();
    if (body.action === "accept") router.refresh();
    return true;
  };

  const open = live.status === "open";
  const myOffer = live.offers.find((o) => o.mine && o.status !== "withdrawn");
  const [sort, setSort] = useState<"best" | "low" | "top">("best");
  const visibleOffers = live.offers
    .filter((o) => o.status !== "withdrawn")
    .slice()
    .sort((a, b) =>
      sort === "low"
        ? a.amount - b.amount
        : sort === "top"
          ? b.rating - a.rating || b.ratingCount - a.ratingCount
          : b.score - a.score,
    );

  return (
    <div className="space-y-10">
      {!open && live.agreedPrice !== null && (
        <section className="notch-frame" aria-labelledby="assigned-h">
          <div className="notch-card terrace-edge p-5">
            <h2 id="assigned-h" className="font-display flex items-center gap-2 text-xl font-bold">
              <CheckCircle2 size={20} aria-hidden className="text-accent" /> {k.assignedTitle}
            </h2>
            <p className="text-muted mt-1">{k.assignedLead(rs(live.agreedPrice, lang))}</p>
            {scheduleHref ? (
              <Link href={scheduleHref} className="btn btn-primary mt-4">
                {t.payments.title} <ArrowRight size={17} aria-hidden />
              </Link>
            ) : (
              live.owner && (
                <Link href={`/booking/${taskId}`} className="btn btn-primary mt-4">
                  {k.choosePlan} <ArrowRight size={17} aria-hidden />
                </Link>
              )
            )}
          </div>
        </section>
      )}

      {/* Provider: make or update an offer */}
      {!live.owner && open && (
        <OfferForm
          taskId={taskId}
          isProvider={isProvider}
          idVerified={idVerified}
          existing={myOffer}
          fairLow={fairLow}
          fairHigh={fairHigh}
          taskDays={taskDays}
          budget={budget}
          onDone={refresh}
          onWithdraw={myOffer ? () => act(myOffer.id, { action: "withdraw" }) : undefined}
        />
      )}

      {/* Client: KYC before hiring */}
      {live.owner && open && !idVerified && visibleOffers.length > 0 && (
        <p className="border-line bg-accent-soft flex flex-wrap items-center gap-3 rounded-[10px] border p-4 text-sm font-semibold">
          {k.kycHire}{" "}
          <Link href="/verification" className="btn btn-ghost !min-h-9">
            {k.verifyNow}
          </Link>
        </p>
      )}

      <section aria-labelledby="offers-h">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="offers-h" className="font-display text-2xl font-bold">
            {k.offers}{" "}
            <span className="text-muted">
              ({lang === "ne" ? toDeva(visibleOffers.length) : visibleOffers.length})
            </span>
          </h2>
          {open && (
            <span className="text-muted inline-flex items-center gap-1.5 text-sm">
              <Loader2 size={14} aria-hidden className="animate-spin" /> {k.waiting}
            </span>
          )}
        </div>
        <p className="text-muted mt-1 text-sm">{k.offersLead}</p>
        {visibleOffers.length > 1 && (
          <div
            role="radiogroup"
            aria-label={k.sortBy}
            className="border-line bg-surface mt-3 inline-flex rounded-full border p-1"
          >
            {(["best", "low", "top"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={sort === s}
                onClick={() => setSort(s)}
                className={`min-h-9 rounded-full px-4 text-sm font-semibold transition-colors ${sort === s ? "bg-accent text-accent-contrast" : "text-muted hover:text-text"}`}
              >
                {k.sorts[s]}
              </button>
            ))}
          </div>
        )}
        {err && (
          <p role="alert" className="field-error mt-3">
            {err}
          </p>
        )}
        <div aria-live="polite">
          {visibleOffers.length === 0 ? (
            <p className="border-line-strong text-muted mt-5 rounded-[4px] border border-dashed p-6 text-center">
              {k.noOffers}
            </p>
          ) : (
            <ol className="mt-5 space-y-4">
              {visibleOffers.map((o) => (
                <li key={o.id}>
                  <OfferTicket o={o} owner={live.owner} open={open} onAct={act} taskId={taskId} />
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <QAPanel
        taskId={taskId}
        owner={live.owner}
        questions={live.questions}
        onDone={refresh}
        errText={errText}
      />
    </div>
  );
}
