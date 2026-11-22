"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { npDate, num } from "@/lib/format";

type Kind = "id" | "selfie" | "address" | "womenGroup";
type Reason = "fraud" | "harassment" | "unsafe" | "off_platform" | "fake" | "other";
type RStatus = "open" | "reviewing" | "actioned" | "dismissed";

export interface AdminData {
  demoMode: boolean;
  verifications: {
    id: string;
    userId: string;
    userName: string;
    kind: Kind;
    submittedAt: string;
    fields: Record<string, string>;
    files: { id: string; label: string; mime: string }[];
  }[];
  reports: {
    id: string;
    reason: Reason;
    details: string;
    status: RStatus;
    createdAt: string;
    reporter: string;
    target: string | null;
    taskTitle: string | null;
  }[];
  disputes: {
    id: string;
    bookingId: string;
    taskTitle: string;
    openedBy: string;
    role: "client" | "provider";
    reason: string;
    wanted: "redo" | "refund";
    createdAt: string;
    clientName: string;
    providerName: string;
  }[];
  prices: {
    id: string;
    en: string;
    ne: string;
    unit: string;
    low: number;
    high: number;
    perDay: number;
    edited: string | null;
  }[];
}

export type Tab = "verify" | "reports" | "disputes" | "prices" | "demo";

export function AdminView({ data, initial = "verify" }: { data: AdminData; initial?: Tab }) {
  const { t } = useI18n();
  const a = t.admin;
  const [tab, setTab] = useState<Tab>(initial);
  const openReports = data.reports.filter((r) => r.status === "open" || r.status === "reviewing").length;
  const counts: Partial<Record<Tab, number>> = {
    verify: data.verifications.length,
    reports: openReports,
    disputes: data.disputes.length,
  };
  const tabs: Tab[] = ["verify", "reports", "disputes", "prices", "demo"];

  return (
    <div>
      <div
        role="tablist"
        aria-label={a.title}
        className="border-line flex [scrollbar-width:none] gap-1 overflow-x-auto border-b"
      >
        {tabs.map((k) => (
          <button
            key={k}
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            type="button"
            onClick={() => setTab(k)}
            className={`-mb-px shrink-0 border-b-2 px-4 py-3 font-semibold ${tab === k ? "border-accent text-ink" : "text-muted hover:text-ink border-transparent"}`}
          >
            {a.tabs[k]}
            {counts[k] ? (
              <span className="bg-marigold text-marigold-ink ml-2 rounded-full px-2 py-0.5 text-xs font-bold">
                {num(counts[k]!, "en")}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-6">
        {tab === "verify" && <VerifyQueue items={data.verifications} />}
        {tab === "reports" && <Reports items={data.reports} />}
        {tab === "disputes" && <Disputes items={data.disputes} />}
        {tab === "prices" && <Prices rows={data.prices} />}
        {tab === "demo" && <DemoReset enabled={data.demoMode} />}
      </div>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="border-line-strong text-muted rounded-[4px] border border-dashed p-6 text-center">{text}</p>
);

function VerifyQueue({ items }: { items: AdminData["verifications"] }) {
  const { t, lang } = useI18n();
  const a = t.admin;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  if (items.length === 0) return <Empty text={a.empty} />;

  const decide = async (v: AdminData["verifications"][number], decision: "verified" | "rejected") => {
    setBusy(v.id);
    setErr(null);
    const r = await postJson("/api/verification/review", {
      userId: v.userId,
      kind: v.kind,
      decision,
      note: notes[v.id]?.trim() || undefined,
      submittedAt: v.submittedAt || undefined,
    });
    setBusy(null);
    if (r.ok) router.refresh();
    else if (r.error === "not_pending") {
      setErr(t.adminDash.changedWhileOpen);
      router.refresh();
    } else setErr(t.errors.generic);
  };

  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {err && (
        <li role="alert" className="field-error lg:col-span-2">
          {err}
        </li>
      )}
      {items.map((v) => (
        <li key={v.id} className="border-line bg-surface rounded-[4px] border p-5">
          <p className="font-display text-lg font-bold">{t.profile.checks[v.kind]}</p>
          <p className="text-muted text-sm">
            {a.user}: <strong className="text-ink">{v.userName}</strong> · {a.submitted}{" "}
            {v.submittedAt ? npDate(v.submittedAt, lang, { time: true }) : "—"}
          </p>
          {Object.keys(v.fields).length > 0 && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {Object.entries(v.fields).map(([k, val]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words">{val}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {v.files
              .filter((f) => f.mime.startsWith("image/"))
              .map((f) => (
                <a
                  key={f.id}
                  href={`/api/verification/file/${f.id}?user=${v.userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost !min-h-0 py-1.5 text-sm"
                >
                  <ExternalLink size={14} aria-hidden /> {a.view}: {f.label}
                </a>
              ))}
          </div>
          <label className="mt-3 block">
            <span className="field-label !text-sm">{a.rejectNote}</span>
            <input
              className="input"
              maxLength={300}
              value={notes[v.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [v.id]: e.target.value }))}
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={busy === v.id}
              onClick={() => void decide(v, "verified")}
            >
              <Check size={18} aria-hidden /> {a.approve}
            </button>
            <button
              type="button"
              className="btn btn-ghost flex-1"
              disabled={busy === v.id}
              onClick={() => void decide(v, "rejected")}
            >
              <X size={18} aria-hidden /> {a.reject}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Reports({ items }: { items: AdminData["reports"] }) {
  const { t, lang } = useI18n();
  const a = t.admin;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (items.length === 0) return <Empty text={a.empty} />;
  const set = async (id: string, status: "reviewing" | "actioned" | "dismissed") => {
    setBusy(id);
    const r = await postJson("/api/admin", { action: "report", id, status });
    setBusy(null);
    if (r.ok) router.refresh();
  };
  return (
    <ul className="space-y-4">
      {items.map((r) => (
        <li key={r.id} className="border-line bg-surface rounded-[4px] border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-display text-lg font-bold">{t.safety.reasons[r.reason]}</p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.status === "open" ? "bg-marigold text-marigold-ink" : "bg-surface-2"}`}
            >
              {a.status[r.status]}
            </span>
          </div>
          <p className="text-muted text-sm">
            {a.reportBy}: <strong className="text-ink">{r.reporter}</strong>
            {r.target && (
              <>
                {" "}
                · {a.target}: <strong className="text-ink">{r.target}</strong>
              </>
            )}
            {r.taskTitle && <> · {r.taskTitle}</>} · {npDate(r.createdAt, lang, { time: true })}
          </p>
          {r.details && <p className="mt-2 whitespace-pre-line">{r.details}</p>}
          {(r.status === "open" || r.status === "reviewing") && (
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "open" && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy === r.id}
                  onClick={() => void set(r.id, "reviewing")}
                >
                  {a.markReviewing}
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy === r.id}
                onClick={() => void set(r.id, "actioned")}
              >
                {a.markActioned}
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                disabled={busy === r.id}
                onClick={() => void set(r.id, "dismissed")}
              >
                {a.dismiss}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Disputes({ items }: { items: AdminData["disputes"] }) {
  const { t, lang } = useI18n();
  const a = t.admin;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (items.length === 0) return <Empty text={a.empty} />;
  const resolve = async (bookingId: string, outcome: "redo" | "refund") => {
    setBusy(bookingId);
    setErr(null);
    const r = await postJson(`/api/bookings/${bookingId}/dispute`, { action: "resolve", outcome });
    setBusy(null);
    if (r.ok) router.refresh();
    else setErr(t.errors.generic);
  };
  return (
    <ul className="space-y-4">
      {err && (
        <li role="alert" className="field-error">
          {err}
        </li>
      )}
      {items.map((d) => (
        <li key={d.id} className="border-line bg-surface rounded-[4px] border p-5">
          <a
            href={`/payments/${d.bookingId}`}
            className="font-display text-lg font-bold underline-offset-2 hover:underline"
          >
            {d.taskTitle}
          </a>
          <p className="text-muted text-sm">
            {d.clientName} ↔ {d.providerName} · {a.openedBy}:{" "}
            <strong className="text-ink">{d.openedBy}</strong> · {npDate(d.createdAt, lang, { time: true })}
          </p>
          <p className="mt-2 whitespace-pre-line">{d.reason}</p>
          <p className="mt-1 text-sm">
            <span className="text-muted">{a.wanted}:</span>{" "}
            <strong>{d.wanted === "redo" ? a.resolveRedo : a.resolveRefund}</strong>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === d.bookingId}
              onClick={() => void resolve(d.bookingId, "redo")}
            >
              {a.resolveRedo}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy === d.bookingId}
              onClick={() => void resolve(d.bookingId, "refund")}
            >
              {a.resolveRefund}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Prices({ rows }: { rows: AdminData["prices"] }) {
  const { t, lang } = useI18n();
  const a = t.admin;
  const router = useRouter();
  const [vals, setVals] = useState(() =>
    Object.fromEntries(rows.map((r) => [r.id, { low: r.low, high: r.high, perDay: r.perDay }])),
  );
  const [state, setState] = useState<Record<string, "saving" | "saved" | "error">>({});
  const save = async (id: string) => {
    setState((s) => ({ ...s, [id]: "saving" }));
    const r = await postJson("/api/admin", { action: "price", category: id, ...vals[id] });
    setState((s) => ({ ...s, [id]: r.ok ? "saved" : "error" }));
    if (r.ok) router.refresh();
  };
  const field = (id: string, k: "low" | "high" | "perDay", label: string) => (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={100}
        step={100}
        className="input !min-h-10 w-28 py-1.5"
        value={vals[id][k]}
        onChange={(e) => {
          const n = Number(e.target.value);
          setVals((v) => ({ ...v, [id]: { ...v[id], [k]: Number.isFinite(n) ? n : 0 } }));
          setState((s) => {
            const c = { ...s };
            delete c[id];
            return c;
          });
        }}
      />
    </label>
  );
  return (
    <div>
      <p className="text-muted mb-4 max-w-3xl">
        <span className="demo-tag mr-2">Example</span>
        {a.priceNote}
      </p>
      <div className="border-line overflow-x-auto rounded-[4px] border">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" className="p-3">
                {a.category}
              </th>
              <th scope="col" className="p-3">
                {a.unit}
              </th>
              <th scope="col" className="p-3">
                {a.low} (Rs.)
              </th>
              <th scope="col" className="p-3">
                {a.high} (Rs.)
              </th>
              <th scope="col" className="p-3">
                {a.perDay} (Rs.)
              </th>
              <th scope="col" className="p-3">
                <span className="sr-only">{a.save}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = vals[r.id];
              const bad = v.low < 100 || v.high <= v.low || v.perDay < 100;
              return (
                <tr key={r.id} className="border-line border-t">
                  <th scope="row" className="p-3 font-semibold">
                    {lang === "ne" ? r.ne : r.en}
                    {r.edited && (
                      <span className="text-muted block text-xs font-normal">
                        {a.edited} {npDate(r.edited, lang)}
                      </span>
                    )}
                  </th>
                  <td className="text-muted p-3">{r.unit}</td>
                  <td className="p-3">{field(r.id, "low", `${r.en} ${a.low}`)}</td>
                  <td className="p-3">{field(r.id, "high", `${r.en} ${a.high}`)}</td>
                  <td className="p-3">{field(r.id, "perDay", `${r.en} ${a.perDay}`)}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="btn btn-ghost !min-h-10 py-1.5"
                      disabled={bad || state[r.id] === "saving"}
                      onClick={() => void save(r.id)}
                    >
                      {state[r.id] === "saved" ? (
                        <>
                          <Check size={16} aria-hidden /> {a.saved}
                        </>
                      ) : (
                        a.save
                      )}
                    </button>
                    {state[r.id] === "error" && (
                      <span role="alert" className="field-error block">
                        {t.errors.generic}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DemoReset({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const a = t.admin;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const reset = async () => {
    if (!window.confirm(a.resetConfirm)) return;
    setBusy(true);
    const r = await postJson<{ signedOut: boolean }>("/api/admin", { action: "reset-demo" });
    setBusy(false);
    if (!r.ok) {
      setMsg(t.errors.generic);
      return;
    }
    setMsg(a.resetDone);
    if (r.signedOut) window.location.assign("/login");
  };
  return (
    <div className="border-line bg-surface max-w-2xl rounded-[4px] border p-6">
      <h2 className="font-display text-xl font-bold">{a.reset}</h2>
      <p className="text-muted mt-2">{a.resetLead}</p>
      {enabled ? (
        <button type="button" className="btn btn-danger mt-4" disabled={busy} onClick={() => void reset()}>
          <RotateCcw size={18} aria-hidden /> {a.reset}
        </button>
      ) : (
        <p className="mt-4 font-semibold">{a.demoOnly}</p>
      )}
      {msg && (
        <p role="status" className="mt-3 font-semibold">
          {msg}
        </p>
      )}
    </div>
  );
}
