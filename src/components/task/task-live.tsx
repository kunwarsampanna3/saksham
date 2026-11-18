"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Star, MapPin, Globe2, Sparkles, Trophy, ChevronDown, MessageCircleQuestion, Send, CheckCircle2, Clock, Users, ArrowRight, Loader2 } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { rs, rsRange } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";
import type { ReasonCode } from "@/lib/rules";
import { StartChat } from "@/components/chat/start-chat";

export interface Offer {
  id: string; providerId: string; providerName: string; profileHref: string | null; isExample: boolean;
  amount: number; days: number; message: string; status: "active" | "accepted" | "declined" | "withdrawn";
  counter?: { amount: number; status: "pending" | "accepted" | "declined" };
  rating: number; ratingCount: number; jobs: number; verified: boolean; womenLed: boolean; distanceKm: number | null;
  score: number; reasons: ReasonCode[]; best: boolean; mine: boolean;
}
export interface QA { id: string; askerName: string; body: string; answer: string | null; mine: boolean }
export interface Live { status: string; agreedPrice: number | null; acceptedBidId: string | null; offers: Offer[]; questions: QA[]; owner: boolean }

export function TaskLive({
  taskId, initial, isProvider, idVerified, fairLow, fairHigh, taskDays, scheduleHref,
}: { taskId: string; initial: Live; isProvider: boolean; idVerified: boolean; fairLow: number; fairHigh: number; taskDays: number; scheduleHref: string | null }) {
  const { t, lang } = useI18n();
  const k = t.task;
  const router = useRouter();
  const [live, setLive] = useState<Live>(initial);
  const [err, setErr] = useState<string | null>(null);
  const errText = (e?: string) => (e && e in k.errors ? k.errors[e as keyof typeof k.errors] : e === "offline" ? t.errors.offline : t.errors.generic);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/tasks/${taskId}/live`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setLive(r);
  }, [taskId]);

  // Poll every 5 s while the tab is visible — new offers, counters and answers appear without reloading.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!timer) timer = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000); };
    start();
    const onVis = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { if (timer) clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [refresh]);

  const act = async (bidId: string, body: Record<string, unknown>) => {
    setErr(null);
    const r = await postJson<{ next?: string }>(`/api/tasks/${taskId}/bids/${bidId}`, body);
    if (!r.ok) { setErr(errText(r.error)); return false; }
    await refresh();
    if (body.action === "accept") router.refresh();
    return true;
  };

  const open = live.status === "open";
  const myOffer = live.offers.find((o) => o.mine && o.status !== "withdrawn");
  const visibleOffers = live.offers.filter((o) => o.status !== "withdrawn");

  return (
    <div className="space-y-10">
      {!open && live.agreedPrice !== null && (
        <section className="notch-frame" aria-labelledby="assigned-h">
          <div className="notch-card terrace-edge p-5">
            <h2 id="assigned-h" className="font-display flex items-center gap-2 text-xl font-bold"><CheckCircle2 size={20} aria-hidden className="text-accent" /> {k.assignedTitle}</h2>
            <p className="mt-1 text-muted">{k.assignedLead(rs(live.agreedPrice, lang))}</p>
            {scheduleHref
              ? <Link href={scheduleHref} className="btn btn-primary mt-4">{t.payments.title} <ArrowRight size={17} aria-hidden /></Link>
              : live.owner && <Link href={`/booking/${taskId}`} className="btn btn-primary mt-4">{k.choosePlan} <ArrowRight size={17} aria-hidden /></Link>}
          </div>
        </section>
      )}

      {/* Provider: make or update an offer */}
      {!live.owner && open && (
        <OfferForm taskId={taskId} isProvider={isProvider} idVerified={idVerified} existing={myOffer} fairLow={fairLow} fairHigh={fairHigh} taskDays={taskDays}
          onDone={refresh} onWithdraw={myOffer ? () => act(myOffer.id, { action: "withdraw" }) : undefined} />
      )}

      <section aria-labelledby="offers-h">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="offers-h" className="font-display text-2xl font-bold">{k.offers} <span className="text-muted">({lang === "ne" ? toDeva(visibleOffers.length) : visibleOffers.length})</span></h2>
          {open && <span className="inline-flex items-center gap-1.5 text-sm text-muted"><Loader2 size={14} aria-hidden className="animate-spin" /> {k.waiting}</span>}
        </div>
        <p className="mt-1 text-sm text-muted">{k.offersLead}</p>
        {err && <p role="alert" className="field-error mt-3">{err}</p>}
        <div aria-live="polite">
          {visibleOffers.length === 0 ? (
            <p className="mt-5 rounded-[4px] border border-dashed border-line-strong p-6 text-center text-muted">{k.noOffers}</p>
          ) : (
            <ol className="mt-5 space-y-4">
              {visibleOffers.map((o) => (
                <li key={o.id}><OfferTicket o={o} owner={live.owner} open={open} onAct={act} taskId={taskId} /></li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <QAPanel taskId={taskId} owner={live.owner} questions={live.questions} onDone={refresh} errText={errText} />
    </div>
  );
}

/* ---------------------------------------------------------------- offer ticket */
function reasonText(r: ReasonCode, k: ReturnType<typeof useI18n>["t"]["task"], lang: "en" | "ne") {
  const n = (x: number, d = 1) => (lang === "ne" ? toDeva(x.toFixed(d)) : x.toFixed(d));
  switch (r.k) {
    case "rating": return k.reasons.rating(n(r.v));
    case "near": return k.reasons.near(n(r.v));
    case "jobs": return k.reasons.jobs(r.v);
    default: return k.reasons[r.k];
  }
}

function OfferTicket({ o, owner, open, onAct, taskId }: { o: Offer; owner: boolean; open: boolean; onAct: (id: string, b: Record<string, unknown>) => Promise<boolean>; taskId: string }) {
  const { t, lang } = useI18n();
  const k = t.task;
  const [why, setWhy] = useState(o.best);
  const [countering, setCountering] = useState(false);
  const [amount, setAmount] = useState(Math.round((o.amount * 0.95) / 100) * 100);
  const [busy, setBusy] = useState(false);
  const closed = o.status !== "active";
  const run = async (b: Record<string, unknown>) => { setBusy(true); const ok = await onAct(o.id, b); setBusy(false); return ok; };

  return (
    <article className={`notch-frame ${closed && o.status !== "accepted" ? "opacity-60" : ""}`} aria-label={`${o.providerName}, ${rs(o.amount, lang)}`}>
      <div className="ticket">
        <div className="px-6 pb-4 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {o.best && open && <span className="inline-flex items-center gap-1 rounded-[3px] bg-marigold px-2 py-0.5 text-xs font-extrabold text-ink"><Trophy size={12} aria-hidden /> {k.best}</span>}
                {o.isExample && <span className="demo-tag">{k.exampleOffer}</span>}
                {o.status === "accepted" && <span className="rounded-[3px] bg-accent px-2 py-0.5 text-xs font-bold text-accent-contrast">{k.accepted}</span>}
                {o.status === "declined" && <span className="rounded-[3px] bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">{k.declined}</span>}
              </div>
              <h3 className="font-display mt-1.5 text-lg font-bold">
                {o.profileHref ? <Link href={o.profileHref} className="hover:text-accent hover:underline">{o.providerName}</Link> : o.providerName}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                {o.verified && <span className="stamp !text-[0.65rem]"><BadgeCheck size={12} aria-hidden /> {t.browse.verified}</span>}
                {o.womenLed && <span className="inline-flex items-center gap-1 font-semibold text-[#8a3a1d] dark:text-[#f0b49c]"><Users size={13} aria-hidden /> {t.browse.womenLed}</span>}
                <span className="inline-flex items-center gap-1">
                  <Star size={14} aria-hidden className={o.ratingCount ? "fill-marigold text-marigold" : ""} />
                  {o.ratingCount ? (lang === "ne" ? toDeva(o.rating.toFixed(1)) : o.rating.toFixed(1)) : k.newProvider}
                </span>
                <span className="inline-flex items-center gap-1">
                  {o.distanceKm === null ? <Globe2 size={13} aria-hidden /> : <MapPin size={13} aria-hidden />}
                  {o.distanceKm === null ? t.browse.online : t.browse.km(o.distanceKm.toFixed(1))}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-extrabold">{rs(o.amount, lang)}</p>
              <p className="text-sm text-muted"><Clock size={13} aria-hidden className="mr-1 inline" />{k.daysShort(o.days)}</p>
            </div>
          </div>

          {o.message && <p className="mt-3 whitespace-pre-line rounded-[4px] bg-surface-2 p-3 text-[0.95rem]">{o.message}</p>}

          <button type="button" onClick={() => setWhy((w) => !w)} aria-expanded={why} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent">
            <ChevronDown size={15} aria-hidden className={`transition-transform ${why ? "rotate-180" : ""}`} /> {k.why}
          </button>
          {why && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {o.reasons.map((r) => <li key={r.k} className="rounded-[3px] border border-line px-2 py-0.5 text-xs font-semibold">{reasonText(r, k, lang)}</li>)}
              <li className="px-1 py-0.5 text-xs text-muted">score {o.score.toFixed(2)}</li>
            </ul>
          )}

          {o.counter && (
            <p className={`mt-3 text-sm font-semibold ${o.counter.status === "accepted" ? "text-accent" : o.counter.status === "declined" ? "text-danger" : "text-marigold-ink dark:text-marigold"}`}>
              {o.counter.status === "pending" && (o.mine ? k.counterFromClient(rs(o.counter.amount, lang)) : k.counterPending(rs(o.counter.amount, lang)))}
              {o.counter.status === "accepted" && k.counterAccepted(rs(o.counter.amount, lang))}
              {o.counter.status === "declined" && k.counterDeclined(rs(o.counter.amount, lang))}
            </p>
          )}

          {/* chat: client ↔ a real provider (example providers can't reply) */}
          {!o.isExample && (owner || o.mine) && (
            <div className="mt-3">
              <StartChat taskId={taskId} withUserId={owner ? o.providerId : undefined} label={t.msg.start} className="btn btn-quiet !min-h-9 -ml-2 text-sm" />
            </div>
          )}
        </div>

        {/* actions */}
        {open && !closed && (owner || (o.mine && o.counter?.status === "pending")) && (
          <>
            <div className="perforation mx-5" aria-hidden />
            <div className="flex flex-wrap items-center gap-2 px-6 pb-5 pt-3">
              {owner && (
                <>
                  {!o.counter || o.counter.status === "declined" ? (
                    countering ? (
                      <form className="flex flex-wrap items-center gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "counter", amount })) setCountering(false); }}>
                        <label className="sr-only" htmlFor={`c-${o.id}`}>{k.counter}</label>
                        <input id={`c-${o.id}`} type="number" min={Math.ceil(o.amount * 0.5)} max={o.amount - 1} step={50} value={amount}
                          onChange={(e) => setAmount(Number(e.target.value) || 0)} className="input !min-h-10 w-32 font-display font-bold" />
                        <button type="submit" className="btn btn-ghost !min-h-10" disabled={busy}>{k.counterSend}</button>
                        <p className="w-full text-xs text-muted">{k.counterLead(rs(o.amount, lang))}</p>
                      </form>
                    ) : (
                      <button type="button" className="btn btn-ghost !min-h-10" onClick={() => setCountering(true)}>{k.counter}</button>
                    )
                  ) : null}
                  <button type="button" className="btn btn-primary !min-h-10 ml-auto" disabled={busy}
                    onClick={() => { if (window.confirm(k.acceptConfirm(o.providerName, rs(o.amount, lang)))) void run({ action: "accept" }); }}>
                    <CheckCircle2 size={16} aria-hidden /> {k.accept}
                  </button>
                </>
              )}
              {o.mine && o.counter?.status === "pending" && (
                <>
                  <button type="button" className="btn btn-primary !min-h-10" disabled={busy} onClick={() => void run({ action: "respond", accept: true })}>{k.acceptCounter}</button>
                  <button type="button" className="btn btn-ghost !min-h-10" disabled={busy} onClick={() => void run({ action: "respond", accept: false })}>{k.declineCounter}</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- provider offer form */
function OfferForm({ taskId, isProvider, idVerified, existing, fairLow, fairHigh, taskDays, onDone, onWithdraw }: {
  taskId: string; isProvider: boolean; idVerified: boolean; existing?: Offer; fairLow: number; fairHigh: number; taskDays: number;
  onDone: () => Promise<void>; onWithdraw?: () => Promise<boolean>;
}) {
  const { t, lang } = useI18n();
  const k = t.task;
  const mid = Math.round((fairLow + fairHigh) / 2 / 100) * 100;
  const [amount, setAmount] = useState(existing?.amount ?? mid);
  const [days, setDays] = useState(existing?.days ?? taskDays);
  const [message, setMessage] = useState(existing?.message ?? "");
  const [busy, setBusy] = useState<"send" | "ai" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } setSent(false); }, [amount, days, message]);

  if (!isProvider) return <p className="rounded-[4px] bg-surface-2 p-4 text-sm">{k.switchProvider}</p>;
  if (!idVerified) {
    return (
      <p className="flex flex-wrap items-center gap-3 rounded-[4px] bg-surface-2 p-4 text-sm">
        {k.idNeeded} <Link href="/verification" className="btn btn-ghost !min-h-9">{k.verifyNow}</Link>
      </p>
    );
  }

  const draft = async () => {
    setBusy("ai"); setErr(null);
    const r = await postJson<{ text: string }>("/api/ai/draft-proposal", { taskId, amount, days, lang });
    setBusy(null);
    if (r.ok && r.text) setMessage(r.text); else setErr(t.errors.generic);
  };

  const send = async () => {
    setBusy("send"); setErr(null);
    const r = await postJson(`/api/tasks/${taskId}/bids`, { amount, days, message });
    setBusy(null);
    if (!r.ok) { setErr(r.error && r.error in k.errors ? k.errors[r.error as keyof typeof k.errors] : t.errors.generic); return; }
    setSent(true);
    await onDone();
  };

  return (
    <section aria-labelledby="offer-h" className="notch-frame">
      <form className="notch-card terrace-edge space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <h2 id="offer-h" className="font-display text-xl font-bold">{existing ? k.yourOffer : k.makeOffer}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="field-label">{k.amount}</span>
            <input type="number" min={100} step={50} inputMode="numeric" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="input font-display text-lg font-bold" />
            <span className="field-hint">{t.task.fairRange}: {rsRange(fairLow, fairHigh, lang)}</span></label>
          <label className="block"><span className="field-label">{k.offerDays}</span>
            <input type="number" min={1} max={90} inputMode="numeric" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} className="input" /></label>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="offer-msg" className="field-label mb-0">{k.message}</label>
            <button type="button" className="btn btn-quiet !min-h-9 text-sm" onClick={() => void draft()} disabled={busy !== null}>
              <Sparkles size={15} aria-hidden /> {busy === "ai" ? t.post.drafting : k.draft}
            </button>
          </div>
          <textarea id="offer-msg" rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={k.messagePh} className="input mt-1.5 resize-y py-3" />
          <p className="field-hint">{k.draftNote}</p>
        </div>
        {err && <p role="alert" className="field-error">{err}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn btn-primary" disabled={busy !== null}><Send size={16} aria-hidden /> {busy === "send" ? k.sending : existing ? k.updateOffer : k.send}</button>
          {sent && <span role="status" className="text-sm font-semibold text-accent"><CheckCircle2 size={15} aria-hidden className="mr-1 inline" />✓</span>}
          {existing && onWithdraw && <button type="button" className="btn btn-quiet ml-auto text-sm !text-danger" onClick={() => void onWithdraw()}>{k.withdraw}</button>}
        </div>
      </form>
    </section>
  );
}

/* ---------------------------------------------------------------- Q&A */
function QAPanel({ taskId, owner, questions, onDone, errText }: { taskId: string; owner: boolean; questions: QA[]; onDone: () => Promise<void>; errText: (e?: string) => string }) {
  const { t } = useI18n();
  const k = t.task;
  const [body, setBody] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    const r = await postJson(`/api/tasks/${taskId}/questions`, payload);
    setBusy(false);
    if (!r.ok) { setErr(errText(r.error)); return false; }
    await onDone();
    return true;
  };

  return (
    <section aria-labelledby="qa-h">
      <h2 id="qa-h" className="font-display flex items-center gap-2 text-2xl font-bold"><MessageCircleQuestion size={22} aria-hidden className="text-accent" /> {k.qa}</h2>
      <p className="mt-1 text-sm text-muted">{k.qaLead}</p>
      {questions.length === 0 ? <p className="mt-4 text-muted">{k.noQuestions}</p> : (
        <ul className="mt-4 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="border-l-4 border-line-strong bg-surface p-4">
              <p><strong>{q.askerName}:</strong> {q.body}</p>
              {q.answer ? (
                <p className="mt-2 border-l-4 border-leaf pl-3"><strong>↳</strong> {q.answer}</p>
              ) : owner ? (
                <form className="mt-2 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await post({ action: "answer", questionId: q.id, text: answers[q.id] ?? "" })) setAnswers((a) => ({ ...a, [q.id]: "" })); }}>
                  <label className="sr-only" htmlFor={`a-${q.id}`}>{k.answer}</label>
                  <input id={`a-${q.id}`} className="input !min-h-10 flex-1" maxLength={1000} placeholder={k.answerPh} value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                  <button type="submit" className="btn btn-ghost !min-h-10" disabled={busy || !(answers[q.id] ?? "").trim()}>{k.answer}</button>
                </form>
              ) : <p className="mt-1 text-sm text-muted">{k.awaiting}</p>}
            </li>
          ))}
        </ul>
      )}
      {!owner && (
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={async (e) => { e.preventDefault(); if (await post({ action: "ask", body })) setBody(""); }}>
          <label className="sr-only" htmlFor="qa-ask">{k.ask}</label>
          <input id="qa-ask" className="input flex-1" maxLength={500} placeholder={k.askPh} value={body} onChange={(e) => setBody(e.target.value)} />
          <button type="submit" className="btn btn-ghost" disabled={busy || body.trim().length < 2}>{k.askSend}</button>
        </form>
      )}
      {err && <p role="alert" className="field-error mt-2">{err}</p>}
    </section>
  );
}
