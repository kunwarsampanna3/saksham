"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  PackageCheck,
  Unlock,
  Undo2,
  CalendarClock,
  FileText,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Ban,
} from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { useReauth } from "@/components/reauth-dialog";
import { PaySheet } from "./pay-sheet";
import { rs, npDate } from "@/lib/format";

type State = "scheduled" | "held" | "delivered" | "released" | "refunded";
export interface Inst {
  id: string;
  seq: number;
  label: "full" | "first" | "second" | "start" | "middle" | "finish";
  pct: number;
  amount: number;
  dueDate: string;
  state: State;
}
export interface ScheduleProps {
  bookingId: string;
  role: "client" | "provider" | "admin";
  status: "active" | "completed" | "disputed" | "refunded";
  providerName: string;
  taskTitle?: string;
  feeRate?: number;
  providerIsExample: boolean;
  method: "esewa_sandbox" | "khalti_sandbox" | "card_sandbox";
  demoMode: boolean;
  installments: Inst[];
  receipts: {
    id: string;
    kind: "hold" | "release" | "refund";
    amount: number;
    fee: number;
    receiptNo: string;
    createdAt: string;
  }[];
  dispute: { status: string; reason: string; wanted: "redo" | "refund"; resolution?: string } | null;
}

const ICON: Record<State, typeof Lock> = {
  scheduled: CalendarClock,
  held: Lock,
  delivered: PackageCheck,
  released: Unlock,
  refunded: Undo2,
};

export function PaymentSchedule(p: ScheduleProps) {
  const { t, lang } = useI18n();
  const k = t.payments;
  const router = useRouter();
  const { ensureFresh, dialog } = useReauth();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sandboxFor, setSandboxFor] = useState<Inst | null>(null);
  const [releaseFor, setReleaseFor] = useState<Inst | null>(null);

  const fmt = (d: string) => npDate(d, lang);
  const errText = (e?: string) =>
    e && e in k.errors
      ? k.errors[e as keyof typeof k.errors]
      : e === "offline"
        ? t.errors.offline
        : t.errors.generic;

  const act = async (action: "pay" | "deliver" | "release", inst: Inst) => {
    setErr(null);
    if (action !== "deliver" && !(await ensureFresh())) return;
    setBusy(inst.id);
    let r = await postJson(`/api/bookings/${p.bookingId}`, { action, installmentId: inst.id });
    if (!r.ok && r.error === "reauth_required" && (await ensureFresh()))
      r = await postJson(`/api/bookings/${p.bookingId}`, { action, installmentId: inst.id });
    setBusy(null);
    setSandboxFor(null);
    if (!r.ok) setErr(errText(r.error));
    else router.refresh();
  };

  const nextToPay = p.installments.find((i) => i.state === "scheduled");
  const locked = p.status !== "active";
  const sum = (s: State[]) =>
    p.installments.filter((i) => s.includes(i.state)).reduce((a, i) => a + i.amount, 0);
  const total = p.installments.reduce((a, i) => a + i.amount, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-8">
        {p.status === "completed" && <Banner tone="ok" icon={CheckCircle2} text={k.completed} />}
        {p.status === "refunded" && <Banner tone="muted" icon={Undo2} text={k.refundedNote} />}
        {p.status === "disputed" && <Banner tone="warn" icon={AlertTriangle} text={k.disputeOpen} />}
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}

        {/* summary */}
        <dl className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border sm:grid-cols-4">
          {[
            [k.total, total],
            [k.held, sum(["held", "delivered"])],
            [k.released, sum(["released"])],
            [
              p.status === "refunded" ? k.refunded : k.scheduled,
              p.status === "refunded" ? sum(["refunded"]) : sum(["scheduled"]),
            ],
          ].map(([l, v]) => (
            <div key={l as string} className="bg-surface p-4">
              <dt className="text-muted text-xs font-semibold tracking-wider uppercase">{l as string}</dt>
              <dd className="font-display mt-1 text-xl font-extrabold">{rs(v as number, lang)}</dd>
            </div>
          ))}
        </dl>

        {/* timeline */}
        <ol className="space-y-3">
          {p.installments.map((i, idx) => {
            const cancelled = p.status === "refunded" && i.state === "scheduled";
            const Icon = cancelled ? Ban : ICON[i.state];
            const stateLabel = cancelled ? k.states.cancelled : k.states[i.state];
            const tone = cancelled
              ? "var(--line-strong)"
              : i.state === "released"
                ? "var(--accent)"
                : i.state === "held" || i.state === "delivered"
                  ? "var(--marigold)"
                  : i.state === "refunded"
                    ? "var(--danger)"
                    : "var(--line)";
            // Text needs AA contrast, so it never uses the decorative bar colours directly.
            const textTone =
              cancelled || i.state === "scheduled"
                ? "var(--text-muted)"
                : i.state === "released"
                  ? "var(--accent)"
                  : i.state === "refunded"
                    ? "var(--danger)"
                    : "var(--warn-text)";
            const canPay = p.role === "client" && !locked && nextToPay?.id === i.id;
            const canRelease =
              p.role === "client" && !locked && (i.state === "held" || i.state === "delivered");
            const canDeliver =
              !locked &&
              i.state === "held" &&
              (p.role === "provider" || (p.role === "client" && p.providerIsExample && p.demoMode));
            return (
              <li key={i.id} className="notch-frame" style={{ marginLeft: `min(${idx * 1.25}rem, 6vw)` }}>
                <article
                  className="notch-card p-5"
                  style={{ boxShadow: `inset 5px 0 0 0 ${tone}` }}
                  aria-label={`${t.booking.labels[i.label]}: ${stateLabel}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
                    <div>
                      <p className="text-muted text-xs font-semibold tracking-wider uppercase">
                        {i.seq}/{p.installments.length} · {i.pct}%
                      </p>
                      <h3 className="font-display text-lg font-bold">{t.booking.labels[i.label]}</h3>
                      <p className="text-muted text-sm">{t.booking.due(fmt(i.dueDate))}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-2xl font-extrabold">{rs(i.amount, lang)}</p>
                      <p
                        className="inline-flex items-center gap-1 text-sm font-semibold"
                        style={{ color: textTone }}
                      >
                        <Icon size={15} aria-hidden /> {stateLabel}
                      </p>
                    </div>
                  </div>
                  {(canPay || canRelease || canDeliver) && (
                    <div className="mt-4 flex flex-wrap gap-2 pl-2">
                      {canPay && (
                        <button
                          type="button"
                          className="btn btn-primary !min-h-10"
                          disabled={busy !== null}
                          onClick={() => setSandboxFor(i)}
                        >
                          <Lock size={16} aria-hidden /> {k.pay}
                        </button>
                      )}
                      {canDeliver && (
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-10"
                          disabled={busy !== null}
                          onClick={() => void act("deliver", i)}
                        >
                          <PackageCheck size={16} aria-hidden />{" "}
                          {p.role === "client" ? k.deliverDemo : k.deliver}
                        </button>
                      )}
                      {canRelease && (
                        <button
                          type="button"
                          className="btn btn-primary !min-h-10"
                          disabled={busy !== null}
                          onClick={() => setReleaseFor(i)}
                        >
                          <Unlock size={16} aria-hidden /> {k.release}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>

        {/* receipts */}
        <section aria-labelledby="rc-h">
          <h2 id="rc-h" className="font-display text-xl font-bold">
            {k.receipts}
          </h2>
          {p.receipts.length === 0 ? (
            <p className="text-muted mt-2">{k.noReceipts}</p>
          ) : (
            <ul className="divide-line border-line mt-3 divide-y border-y">
              {p.receipts.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span>
                    <span className="font-semibold">{k.receiptKinds[r.kind]}</span>
                    <span className="text-muted block text-sm">
                      {r.receiptNo} · {fmt(r.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-display font-bold">{rs(r.amount, lang)}</span>
                    <Link
                      href={`/payments/${p.bookingId}/receipt/${r.id}`}
                      className="btn btn-quiet !min-h-9 text-sm"
                    >
                      <FileText size={15} aria-hidden /> {k.viewReceipt}
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-6 lg:col-span-4">
        <Guarantee {...p} errText={errText} />
      </aside>

      {dialog}
      {sandboxFor && (
        <PaySheet
          method={p.method}
          amount={sandboxFor.amount}
          amountText={rs(sandboxFor.amount, lang)}
          installment={{ seq: sandboxFor.seq, of: p.installments.length }}
          taskTitle={p.taskTitle ?? ""}
          providerName={p.providerName}
          pay={async () => {
            const r = await postJson<{ ref?: string; receiptId?: string }>(`/api/bookings/${p.bookingId}`, {
              action: "pay",
              installmentId: sandboxFor.id,
            });
            if (!r.ok) return { ok: false, error: errText(r.error) };
            return {
              ok: true,
              ref: r.ref,
              receiptHref: r.receiptId ? `/payments/${p.bookingId}/receipt/${r.receiptId}` : undefined,
            };
          }}
          onClose={() => setSandboxFor(null)}
          onDone={() => {
            setSandboxFor(null);
            router.refresh();
          }}
        />
      )}
      {releaseFor && (
        <PaySheet
          mode="release"
          method={p.method}
          amount={releaseFor.amount}
          amountText={rs(releaseFor.amount, lang)}
          installment={{ seq: releaseFor.seq, of: p.installments.length }}
          taskTitle={p.taskTitle ?? ""}
          providerName={p.providerName}
          fee={Math.round(releaseFor.amount * (p.feeRate ?? 0.07))}
          money={(n) => rs(n, lang)}
          pay={async () => {
            const r = await postJson<{ ref?: string; receiptId?: string }>(`/api/bookings/${p.bookingId}`, {
              action: "release",
              installmentId: releaseFor.id,
            });
            if (!r.ok) return { ok: false, error: errText(r.error) };
            return {
              ok: true,
              ref: r.ref,
              receiptHref: r.receiptId ? `/payments/${p.bookingId}/receipt/${r.receiptId}` : undefined,
            };
          }}
          onClose={() => setReleaseFor(null)}
          onDone={() => {
            setReleaseFor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  text,
}: {
  tone: "ok" | "warn" | "muted";
  icon: typeof Lock;
  text: string;
}) {
  const cls =
    tone === "ok"
      ? "bg-accent-soft text-accent"
      : tone === "warn"
        ? "bg-[#fff1cc] text-[#6b4a00] dark:bg-[#3a2c08] dark:text-[#f6d27a]"
        : "bg-surface-2 text-muted";
  return (
    <p role="status" className={`flex items-center gap-2 rounded-[4px] p-3 font-semibold ${cls}`}>
      <Icon size={18} aria-hidden /> {text}
    </p>
  );
}

function Guarantee(p: ScheduleProps & { errText: (e?: string) => string }) {
  const { t } = useI18n();
  const k = t.payments;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [wanted, setWanted] = useState<"redo" | "refund">("redo");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    const r = await postJson(`/api/bookings/${p.bookingId}/dispute`, payload);
    setBusy(false);
    if (!r.ok) setErr(p.errText(r.error));
    else {
      setOpen(false);
      router.refresh();
    }
  };

  return (
    <section
      aria-labelledby="g-h"
      className="bg-forest relative overflow-hidden rounded-[4px] p-5 text-[#d9e8dd] lg:sticky lg:top-[calc(var(--header-h)+16px)]"
    >
      <h2 id="g-h" className="font-display flex items-center gap-2 text-xl font-bold text-white">
        <ShieldCheck size={20} aria-hidden className="text-leaf" /> {k.guarantee}
      </h2>
      <p className="mt-1 text-sm">{k.guaranteeLead}</p>

      {p.dispute && (
        <div className="mt-4 rounded-[4px] bg-white/10 p-3 text-sm">
          <p className="font-semibold text-white">
            {p.dispute.status === "open"
              ? k.disputeOpen
              : k.resolution(p.dispute.resolution ?? p.dispute.status)}
          </p>
          <p className="mt-1">“{p.dispute.reason}”</p>
        </div>
      )}

      {p.status === "disputed" && p.demoMode && p.role !== "admin" && (
        <div className="mt-4 space-y-2">
          <p className="flex items-center gap-1.5 text-xs">
            <span className="demo-tag !border-white/40 !bg-white/10 !text-white">
              <FlaskConical size={11} aria-hidden /> {t.common.demo}
            </span>{" "}
            {t.verify.demoNote}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost !min-h-10 !border-white/40 !text-white"
              disabled={busy}
              onClick={() => void send({ action: "resolve", outcome: "redo" })}
            >
              {k.resolveRedo}
            </button>
            <button
              type="button"
              className="btn btn-ghost !min-h-10 !border-white/40 !text-white"
              disabled={busy}
              onClick={() => void send({ action: "resolve", outcome: "refund" })}
            >
              {k.resolveRefund}
            </button>
          </div>
        </div>
      )}

      {p.status === "active" &&
        p.role !== "admin" &&
        (open ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim().length < 10) {
                setErr(k.errors.reason);
                return;
              }
              void send({ action: "open", reason, wanted });
            }}
          >
            <label className="block">
              <span className="field-label !text-white">{k.reason}</span>
              <textarea
                rows={4}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={k.reasonPh}
                className="input !text-text resize-y py-2"
              />
            </label>
            <fieldset>
              <legend className="field-label !text-white">{k.wanted}</legend>
              {(["redo", "refund"] as const).map((w) => (
                <label key={w} className="mr-4 inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="wanted"
                    checked={wanted === w}
                    onChange={() => setWanted(w)}
                    className="accent-[var(--leaf)]"
                  />{" "}
                  {k[w]}
                </label>
              ))}
            </fieldset>
            {err && (
              <p role="alert" className="text-sm font-semibold text-[#f6b49c]">
                {err}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary !min-h-10" disabled={busy}>
                {k.sendDispute}
              </button>
              <button
                type="button"
                className="btn btn-quiet !min-h-10 !text-white"
                onClick={() => setOpen(false)}
              >
                {t.common.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn btn-ghost mt-4 !border-white/40 !text-white"
            onClick={() => setOpen(true)}
          >
            <AlertTriangle size={16} aria-hidden /> {k.report}
          </button>
        ))}
      {err && !open && (
        <p role="alert" className="mt-2 text-sm font-semibold text-[#f6b49c]">
          {err}
        </p>
      )}
    </section>
  );
}
