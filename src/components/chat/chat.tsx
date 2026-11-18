"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, ImagePlus, Mic, Send, Square, X, Info, ShieldCheck, Check, CheckCheck, Bell } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { shrinkImage } from "@/components/verify/photo-input";
import { eventText } from "@/lib/events";
import { npDate } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";

interface Item {
  id: string; other: { name: string; verified: boolean }; role: "client" | "provider"; task: { id: string; title: string } | null;
  last: { kind: string; body: string; system: { code: string; params: Record<string, string | number> } | null; mine: boolean; at: string } | null;
  unread: number; lastAt: string;
}
interface Msg {
  id: string; kind: "text" | "voice" | "photo" | "system"; body: string; system: { code: string; params: Record<string, string | number> } | null;
  mine: boolean; file: { url: string; durationSec: number | null } | null; seen: boolean; at: string;
}
interface Thread { other: { name: string; verified: boolean }; task: { id: string; title: string; status: string } | null; contactsAllowed: boolean; messages: Msg[] }

const timeOf = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + (5 * 60 + 45) * 60_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};

export function Chat() {
  const { t, lang } = useI18n();
  const k = t.msg;
  const router = useRouter();
  const sp = useSearchParams();
  const active = sp.get("c");
  const [items, setItems] = useState<Item[] | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [masked, setMasked] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(0);

  const loadList = useCallback(async () => {
    const r = await fetch("/api/messages", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setItems(r.items);
  }, []);
  const loadThread = useCallback(async (id: string) => {
    const r = await fetch(`/api/messages/${id}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r?.ok) setThread(r);
  }, []);

  useEffect(() => { void loadList(); const tm = setInterval(() => document.visibilityState === "visible" && void loadList(), 10_000); return () => clearInterval(tm); }, [loadList]);
  useEffect(() => {
    setThread(null); setMasked(false); lastCount.current = 0;
    if (!active) return;
    void loadThread(active).then(loadList);
    const tm = setInterval(() => document.visibilityState === "visible" && void loadThread(active), 4000);
    return () => clearInterval(tm);
  }, [active, loadThread, loadList]);
  // keep the newest message in view when new ones arrive
  useEffect(() => {
    const n = thread?.messages.length ?? 0;
    if (n !== lastCount.current) { endRef.current?.scrollIntoView({ block: "end" }); lastCount.current = n; }
  }, [thread]);

  const sendText = async () => {
    if (!active || !text.trim()) return;
    setBusy(true); setErr(null);
    const r = await postJson<{ masked: boolean }>(`/api/messages/${active}`, { body: text });
    setBusy(false);
    if (!r.ok) { setErr(k.errors.generic); return; }
    setText(""); setMasked(r.masked);
    await loadThread(active); void loadList();
  };

  const sendMedia = async (kind: "photo" | "voice", blob: Blob, durationSec?: number) => {
    if (!active) return;
    setBusy(true); setErr(null);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", blob, kind === "photo" ? "photo.jpg" : "voice");
    if (durationSec) fd.set("durationSec", String(durationSec));
    const r = await fetch(`/api/messages/${active}/media`, { method: "POST", body: fd, credentials: "same-origin" }).then((x) => x.json()).catch(() => ({ ok: false }));
    setBusy(false);
    if (!r.ok) { setErr(r.error && r.error in k.errors ? k.errors[r.error as keyof typeof k.errors] : k.errors.generic); return; }
    await loadThread(active); void loadList();
  };

  const open = (id: string) => router.push(`/messages?c=${id}`, { scroll: false });

  return (
    <div className="grid min-h-[34rem] overflow-hidden rounded-[4px] border border-line bg-surface lg:grid-cols-12" style={{ height: "calc(100dvh - var(--header-h) - 12rem)" }}>
      {/* conversation list */}
      <section aria-label={k.title} className={`${active ? "hidden lg:flex" : "flex"} min-h-0 flex-col border-line lg:col-span-4 lg:border-r`}>
        {items === null ? (
          <p className="p-6 text-muted">{t.common.loading}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-muted">{k.none}</p>
        ) : (
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {items.map((c) => {
              const preview = !c.last ? "" : c.last.system ? eventText(t, lang, c.last.system.code, c.last.system.params)
                : c.last.kind === "voice" ? k.voiceNote : c.last.kind === "photo" ? k.photoMsg : c.last.body;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => open(c.id)} aria-current={active === c.id ? "true" : undefined}
                    className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left hover:bg-accent-soft ${active === c.id ? "bg-accent-soft" : ""}`}>
                    <span className="font-display inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-forest text-sm font-bold text-white" aria-hidden>
                      {c.other.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{c.other.name}{c.other.verified && <BadgeCheck size={14} aria-label={t.browse.verified} className="ml-1 inline text-accent" />}</span>
                        {c.last && <span className="shrink-0 text-xs text-muted">{timeOf(c.last.at)}</span>}
                      </span>
                      {c.task && <span className="block truncate text-xs font-semibold text-accent">{c.task.title}</span>}
                      <span className={`block truncate text-sm ${c.unread ? "font-semibold text-text" : "text-muted"}`}>{preview}</span>
                    </span>
                    {c.unread > 0 && <span className="mt-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-contrast">{lang === "ne" ? toDeva(c.unread) : c.unread}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* thread */}
      <section aria-label={thread?.other.name ?? k.pick} className={`${active ? "flex" : "hidden lg:flex"} min-h-0 flex-col lg:col-span-8`}>
        {!active ? (
          <p className="m-auto p-6 text-muted">{k.pick}</p>
        ) : !thread ? (
          <p className="m-auto p-6 text-muted">{t.common.loading}</p>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent-soft lg:hidden" onClick={() => router.push("/messages")} aria-label={k.back}>
                <ArrowLeft size={18} aria-hidden />
              </button>
              <div className="min-w-0">
                <p className="font-display truncate text-lg font-bold">{thread.other.name}{thread.other.verified && <BadgeCheck size={16} aria-label={t.browse.verified} className="ml-1 inline text-accent" />}</p>
                {thread.task && <Link href={`/task/${thread.task.id}`} className="block truncate text-sm font-semibold text-accent hover:underline">{k.aboutTask}: {thread.task.title}</Link>}
              </div>
            </header>
            <p className={`flex items-start gap-2 px-4 py-2 text-xs ${thread.contactsAllowed ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}>
              {thread.contactsAllowed ? <ShieldCheck size={14} aria-hidden className="mt-0.5 shrink-0" /> : <Info size={14} aria-hidden className="mt-0.5 shrink-0" />}
              {thread.contactsAllowed ? k.contactsOpen : k.masked}
            </p>

            <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
              {thread.messages.map((m, i) => {
                const prev = thread.messages[i - 1];
                const newDay = !prev || npDate(prev.at, lang) !== npDate(m.at, lang);
                return (
                  <li key={m.id}>
                    {newDay && <p className="my-3 text-center text-xs font-semibold text-muted">{npDate(m.at, lang)}</p>}
                    {m.kind === "system" && m.system ? (
                      <p className="mx-auto flex w-fit max-w-[90%] items-center gap-1.5 rounded-[3px] border border-line bg-surface-2 px-3 py-1.5 text-center text-xs font-semibold">
                        <Bell size={12} aria-hidden className="shrink-0 text-accent" /> {eventText(t, lang, m.system.code, m.system.params)}
                        <span className="font-normal text-muted">· {timeOf(m.at)}</span>
                      </p>
                    ) : (
                      <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-[6px] px-3 py-2 ${m.mine ? "bg-accent text-accent-contrast" : "bg-surface-2"}`}>
                          {m.kind === "text" && <p className="whitespace-pre-line break-words">{m.body}</p>}
                          {m.kind === "photo" && m.file && (
                            <a href={m.file.url} target="_blank" rel="noopener" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-protected file */}
                              <img src={m.file.url} alt={k.photoMsg} loading="lazy" className="max-h-64 rounded-[4px] object-cover" />
                            </a>
                          )}
                          {m.kind === "voice" && m.file && (
                            <div className="flex items-center gap-2">
                              <audio controls preload="none" src={m.file.url} className="h-9 max-w-[14rem]" aria-label={k.voiceNote} />
                              {m.file.durationSec && <span className="text-xs">{m.file.durationSec}s</span>}
                            </div>
                          )}
                          <p className={`mt-0.5 flex items-center justify-end gap-1 text-[0.68rem] ${m.mine ? "text-accent-contrast/80" : "text-muted"}`}>
                            {timeOf(m.at)}
                            {m.mine && (m.seen ? <CheckCheck size={12} aria-label={k.seen} /> : <Check size={12} aria-label={k.sent} />)}
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
              <div ref={endRef} />
            </ol>

            <div className="border-t border-line p-3">
              {masked && <p role="status" className="mb-2 text-xs font-semibold text-[color:var(--warn-text)]">{k.masked}</p>}
              {err && <p role="alert" className="field-error mb-2 !mt-0">{err}</p>}
              <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void sendText(); }}>
                <PhotoButton label={k.photo} disabled={busy} onPick={async (f) => sendMedia("photo", await shrinkImage(f, 1600))} />
                <VoiceButton labels={k} disabled={busy} onDone={(b, s) => void sendMedia("voice", b, s)} onDenied={() => setErr(k.micDenied)} />
                <label htmlFor="chat-text" className="sr-only">{k.placeholder}</label>
                <textarea id="chat-text" rows={1} maxLength={2000} value={text} placeholder={k.placeholder}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendText(); } }}
                  className="input !min-h-11 max-h-32 flex-1 resize-none py-2.5" />
                <button type="submit" className="btn btn-primary !min-h-11 !px-3" disabled={busy || !text.trim()} aria-label={k.send}><Send size={18} aria-hidden /></button>
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PhotoButton({ label, disabled, onPick }: { label: string; disabled: boolean; onPick: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong hover:border-accent hover:text-accent" disabled={disabled} onClick={() => ref.current?.click()} aria-label={label} title={label}>
        <ImagePlus size={18} aria-hidden />
      </button>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onPick(f); }} />
    </>
  );
}

/** Records up to 2 minutes with MediaRecorder (Opus/WebM, or MP4 on Safari). */
function VoiceButton({ labels, disabled, onDone, onDenied }: {
  labels: { voice: string; stop: string; cancelRec: string; recording: string }; disabled: boolean; onDone: (b: Blob, sec: number) => void; onDenied: () => void;
}) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const started = useRef(0);
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia), []);
  useEffect(() => {
    if (!rec) return;
    const tm = setInterval(() => {
      const s = Math.round((Date.now() - started.current) / 1000);
      setSecs(s);
      if (s >= 120) rec.stop();
    }, 250);
    return () => clearInterval(tm);
  }, [rec]);

  if (!supported) return null;

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((x) => MediaRecorder.isTypeSupported(x));
      const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32_000 } : undefined);
      chunks.current = []; cancelled.current = false; started.current = Date.now(); setSecs(0);
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setRec(null);
        const sec = Math.max(1, Math.round((Date.now() - started.current) / 1000));
        if (!cancelled.current && chunks.current.length) onDone(new Blob(chunks.current, { type: r.mimeType }), Math.min(sec, 120));
      };
      r.start(250);
      setRec(r);
    } catch {
      onDenied();
    }
  };

  if (rec) {
    return (
      <div className="flex items-center gap-1" role="status">
        <span className="inline-flex items-center gap-1.5 px-1 text-sm font-semibold text-danger"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden /> {labels.recording} {secs}s</span>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-danger text-white" onClick={() => rec.stop()} aria-label={labels.stop} title={labels.stop}><Square size={16} aria-hidden /></button>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-line-strong" onClick={() => { cancelled.current = true; rec.stop(); }} aria-label={labels.cancelRec}><X size={16} aria-hidden /></button>
      </div>
    );
  }
  return (
    <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line-strong hover:border-accent hover:text-accent" disabled={disabled} onClick={() => void start()} aria-label={labels.voice} title={labels.voice}>
      <Mic size={18} aria-hidden />
    </button>
  );
}
