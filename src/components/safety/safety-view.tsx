"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Siren,
  Phone,
  MapPin,
  Square,
  UserPlus,
  Trash2,
  Flag,
  Ban,
  ShieldCheck,
  FlaskConical,
  Check,
} from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { toDeva } from "@/lib/i18n/dict";

type Person = { id: string; name: string };
const EMERGENCY = [
  { k: "police", n: "100" },
  { k: "fire", n: "101" },
  { k: "ambulance", n: "102" },
  { k: "women", n: "1145" },
] as const;

export function SafetyView({
  initialContacts,
  people,
  blockedIds,
}: {
  initialContacts: { name: string; phone: string }[];
  people: Person[];
  blockedIds: string[];
}) {
  const { t, lang } = useI18n();
  const s = t.safety;
  const router = useRouter();
  const errText = (e?: string) =>
    e && e in s.errors
      ? s.errors[e as keyof typeof s.errors]
      : e === "offline"
        ? t.errors.offline
        : t.errors.generic;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="space-y-8 lg:col-span-7">
        <SosCard contactsCount={initialContacts.length} />
        <LocationCard />
        <ContactsCard initial={initialContacts} errText={errText} />
      </div>
      <div className="space-y-8 lg:col-span-5">
        <section aria-labelledby="em-h" className="border-line rounded-[4px] border p-5">
          <h2 id="em-h" className="font-display text-xl font-bold">
            {s.emergency}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {EMERGENCY.map((e) => (
              <li key={e.n}>
                <a
                  href={`tel:${e.n}`}
                  className="bg-surface-2 hover:bg-accent-soft flex items-center justify-between gap-2 rounded-[4px] px-3 py-2.5"
                >
                  <span>
                    <span className="block text-sm font-semibold">{s[e.k]}</span>
                    <span className="font-display text-xl font-extrabold">
                      {lang === "ne" ? toDeva(e.n) : e.n}
                    </span>
                  </span>
                  <Phone size={18} aria-label={s.call} className="text-accent" />
                </a>
              </li>
            ))}
          </ul>
        </section>
        <ReportCard people={people} errText={errText} onDone={() => router.refresh()} />
        <BlockCard people={people} blockedIds={blockedIds} onDone={() => router.refresh()} />
        <section id="guarantee" aria-labelledby="g-h" className="bg-forest rounded-[4px] p-5 text-[#d9e8dd]">
          <h2 id="g-h" className="font-display flex items-center gap-2 text-xl font-bold text-white">
            <ShieldCheck size={20} aria-hidden className="text-leaf" /> {s.guarantee}
          </h2>
          <p className="mt-1 text-sm">{s.guaranteeLead}</p>
        </section>
      </div>
    </div>
  );
}

/** Press-and-hold SOS (2 s) to avoid accidental alerts. DEMO: nothing is sent. */
function SosCard({ contactsCount }: { contactsCount: number }) {
  const { t } = useI18n();
  const s = t.safety;
  const [progress, setProgress] = useState(0);
  const [sent, setSent] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    if (timer.current) return;
    const t0 = Date.now();
    timer.current = setInterval(async () => {
      const p = Math.min(1, (Date.now() - t0) / 2000);
      setProgress(p);
      if (p >= 1) {
        stop();
        const r = await postJson<{ contacts: number }>("/api/safety", { action: "sos" });
        setSent(r.ok ? r.contacts : contactsCount);
      }
    }, 50);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  return (
    <section aria-labelledby="sos-h" className="notch-frame">
      <div className="notch-card terrace-edge p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <h2 id="sos-h" className="font-display text-2xl font-bold">
            {s.sos}
          </h2>
          <span className="demo-tag">{s.demoAlert}</span>
        </div>
        <button
          type="button"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              start();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") stop();
          }}
          aria-describedby="sos-hint"
          className="bg-clay relative mx-auto mt-4 flex h-36 w-36 items-center justify-center rounded-full text-white shadow-[0_0_0_8px_var(--danger-soft)] select-none focus-visible:outline-offset-4"
          style={{
            backgroundImage: `conic-gradient(rgba(255,255,255,.35) ${progress * 360}deg, transparent 0)`,
          }}
        >
          <span className="flex flex-col items-center">
            <Siren size={40} aria-hidden />
            <span className="font-display mt-1 text-xl font-extrabold">SOS</span>
          </span>
        </button>
        <p id="sos-hint" className="text-muted mt-3 text-sm">
          {s.sosHold}
        </p>
        {contactsCount === 0 && (
          <p className="mt-1 text-sm font-semibold text-[color:var(--warn-text)]">{s.sosNoContacts}</p>
        )}
        {sent !== null && (
          <p role="alert" className="bg-danger-soft text-danger mt-3 rounded-[4px] p-3 text-sm font-semibold">
            <FlaskConical size={14} aria-hidden className="mr-1 inline" />
            {s.sosSent(sent)}
          </p>
        )}
      </div>
    </section>
  );
}

/** Live location (DEMO): watches position on the device only; nothing is uploaded. */
function LocationCard() {
  const { t, lang } = useI18n();
  const s = t.safety;
  const [watchId, setWatchId] = useState<number | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [since, setSince] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [mins, setMins] = useState(0);
  useEffect(
    () => () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    },
    [watchId],
  );
  useEffect(() => {
    if (!since) return;
    const tm = setInterval(() => setMins(Math.floor((Date.now() - since) / 60000)), 10_000);
    return () => clearInterval(tm);
  }, [since]);

  const startShare = () => {
    if (!("geolocation" in navigator)) return setErr(s.locDenied);
    setErr(null);
    const id = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      () => {
        setErr(s.locDenied);
        navigator.geolocation.clearWatch(id);
        setWatchId(null);
      },
      { enableHighAccuracy: true, maximumAge: 15_000 },
    );
    setWatchId(id);
    setSince(Date.now());
    setMins(0);
  };
  const stopShare = () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setPos(null);
    setSince(0);
  };

  return (
    <section aria-labelledby="loc-h" className="border-line rounded-[4px] border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="loc-h" className="font-display text-xl font-bold">
          {s.share}
        </h2>
        <span className="demo-tag">{t.common.demo}</span>
      </div>
      <p className="text-muted mt-1 text-sm">{s.shareNote}</p>
      {watchId === null ? (
        <button type="button" className="btn btn-ghost mt-3" onClick={startShare}>
          <MapPin size={17} aria-hidden /> {s.share}
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3" role="status">
          <span className="text-accent inline-flex items-center gap-2 font-semibold">
            <span className="bg-accent h-2.5 w-2.5 animate-pulse rounded-full" aria-hidden /> {s.sharing}{" "}
            {s.shareSince(mins)}
          </span>
          {pos && (
            <span className="text-muted text-sm">
              {lang === "ne" ? toDeva(pos.lat.toFixed(4)) : pos.lat.toFixed(4)},{" "}
              {lang === "ne" ? toDeva(pos.lng.toFixed(4)) : pos.lng.toFixed(4)} · ±{pos.acc} m
            </span>
          )}
          <button type="button" className="btn btn-ghost !min-h-10" onClick={stopShare}>
            <Square size={15} aria-hidden /> {s.stopShare}
          </button>
        </div>
      )}
      {err && (
        <p role="alert" className="field-error">
          {err}
        </p>
      )}
    </section>
  );
}

function ContactsCard({
  initial,
  errText,
}: {
  initial: { name: string; phone: string }[];
  errText: (e?: string) => string;
}) {
  const { t } = useI18n();
  const s = t.safety;
  const [rows, setRows] = useState(initial.length ? initial : [{ name: "", phone: "" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section aria-labelledby="tc-h" className="border-line rounded-[4px] border p-5">
      <h2 id="tc-h" className="font-display text-xl font-bold">
        {s.contacts}
      </h2>
      <p className="text-muted mt-1 text-sm">{s.contactsLead}</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          const contacts = rows.filter((r) => r.name.trim() || r.phone.trim());
          const r = await postJson("/api/safety", { action: "contacts", contacts });
          setBusy(false);
          setMsg(r.ok ? { ok: true, text: s.saved } : { ok: false, text: errText(r.error) });
        }}
      >
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <label className="block">
              <span className="field-label !text-sm">{s.name}</span>
              <input
                className="input !min-h-11"
                maxLength={60}
                value={r.name}
                onChange={(e) =>
                  setRows((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))
                }
              />
            </label>
            <label className="block">
              <span className="field-label !text-sm">{s.phone}</span>
              <input
                className="input !min-h-11"
                inputMode="tel"
                maxLength={20}
                placeholder="98XXXXXXXX"
                value={r.phone}
                onChange={(e) =>
                  setRows((x) => x.map((y, j) => (j === i ? { ...y, phone: e.target.value } : y)))
                }
              />
            </label>
            <button
              type="button"
              className="border-line-strong text-danger hover:bg-danger-soft inline-flex h-11 w-11 items-center justify-center rounded-md border"
              aria-label={`${s.remove} ${i + 1}`}
              onClick={() => setRows((x) => x.filter((_, j) => j !== i))}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {rows.length < 3 && (
            <button
              type="button"
              className="btn btn-ghost !min-h-10"
              onClick={() => setRows((x) => [...x, { name: "", phone: "" }])}
            >
              <UserPlus size={16} aria-hidden /> {s.addContact}
            </button>
          )}
          <button type="submit" className="btn btn-primary !min-h-10" disabled={busy}>
            {s.saveContacts}
          </button>
        </div>
        {msg && (
          <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-danger"}`}>
            {msg.ok && <Check size={14} aria-hidden className="mr-1 inline" />}
            {msg.text}
          </p>
        )}
      </form>
    </section>
  );
}

function ReportCard({
  people,
  errText,
  onDone,
}: {
  people: Person[];
  errText: (e?: string) => string;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const s = t.safety;
  const [who, setWho] = useState("");
  const [taskId, setTaskId] = useState("");
  const [reason, setReason] = useState<keyof typeof s.reasons>("fraud");
  const [details, setDetails] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section id="report" aria-labelledby="rp-h" className="border-line rounded-[4px] border p-5">
      <h2 id="rp-h" className="font-display flex items-center gap-2 text-xl font-bold">
        <Flag size={18} aria-hidden className="text-danger" /> {s.report}
      </h2>
      <p className="text-muted mt-1 text-sm">{s.reportLead}</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (details.trim().length < 10) return setMsg({ ok: false, text: s.errors.details });
          setBusy(true);
          setMsg(null);
          const tid = taskId
            .trim()
            .replace(/^.*\/task\//, "")
            .split(/[?#]/)[0];
          const r = await postJson("/api/safety", {
            action: "report",
            targetUserId: who || undefined,
            targetTaskId: tid || undefined,
            reason,
            details,
          });
          setBusy(false);
          if (r.ok) {
            setMsg({ ok: true, text: s.reportSent });
            setDetails("");
            onDone();
          } else setMsg({ ok: false, text: errText(r.error) });
        }}
      >
        <label className="block">
          <span className="field-label !text-sm">{s.who}</span>
          <select className="input !min-h-11" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">{s.someone}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label !text-sm">{s.taskId}</span>
          <input
            className="input !min-h-11"
            maxLength={200}
            value={taskId}
            placeholder="/task/…"
            onChange={(e) => setTaskId(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label !text-sm">{s.reason}</span>
          <select
            className="input !min-h-11"
            value={reason}
            onChange={(e) => setReason(e.target.value as typeof reason)}
          >
            {(Object.keys(s.reasons) as (keyof typeof s.reasons)[]).map((k) => (
              <option key={k} value={k}>
                {s.reasons[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label !text-sm">{s.details}</span>
          <textarea
            className="input resize-y py-2"
            rows={3}
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary !min-h-10" disabled={busy}>
          {s.sendReport}
        </button>
        {msg && (
          <p role="status" className={`text-sm font-semibold ${msg.ok ? "text-accent" : "text-danger"}`}>
            {msg.text}
          </p>
        )}
      </form>
    </section>
  );
}

function BlockCard({
  people,
  blockedIds,
  onDone,
}: {
  people: Person[];
  blockedIds: string[];
  onDone: () => void;
}) {
  const { t } = useI18n();
  const s = t.safety;
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (id: string, block: boolean) => {
    setBusy(id);
    await postJson("/api/safety", { action: block ? "block" : "unblock", userId: id });
    setBusy(null);
    onDone();
  };
  return (
    <section aria-labelledby="bl-h" className="border-line rounded-[4px] border p-5">
      <h2 id="bl-h" className="font-display flex items-center gap-2 text-xl font-bold">
        <Ban size={18} aria-hidden /> {s.people}
      </h2>
      <p className="text-muted mt-1 text-sm">{s.blockNote}</p>
      {people.length === 0 ? (
        <p className="text-muted mt-3 text-sm">{s.noPeople}</p>
      ) : (
        <ul className="divide-line mt-3 divide-y">
          {people.map((p) => {
            const isBlocked = blockedIds.includes(p.id);
            return (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span className={isBlocked ? "text-muted line-through" : "font-semibold"}>{p.name}</span>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void toggle(p.id, !isBlocked)}
                  className={`btn !min-h-9 text-sm ${isBlocked ? "btn-ghost" : "btn-quiet !text-danger"}`}
                >
                  {isBlocked ? s.unblock : s.block}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
