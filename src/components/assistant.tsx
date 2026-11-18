"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircleQuestion, Send, X } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";

interface Turn { q: string; a: string; source: "ai" | "fallback" }

/** Page names the assistant is told about (never user data — only where in the app the question was asked). */
const PAGES: [RegExp, string][] = [
  [/^\/post/, "Post a task wizard"], [/^\/task\//, "Task page with offers"], [/^\/payments\//, "Escrow payment schedule"],
  [/^\/wallet/, "Wallet, Earnings Passport and Saksham Credit"], [/^\/verification/, "Identity verification"],
  [/^\/safety/, "Safety and SOS"], [/^\/abroad/, "Hire from abroad"], [/^\/explore/, "Browse tasks map"],
  [/^\/professionals/, "Browse providers"], [/^\/messages/, "Messages"], [/^\/my-tasks/, "My tasks"], [/^\/$/, "Home"],
];

/** Floating Saksham AI help. Answers questions about using the app; it never changes anything. */
export function Assistant() {
  const { t, lang } = useI18n();
  const s = t.assistant;
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (path.startsWith("/admin") || path.startsWith("/messages/")) return null; // keep clear of the chat composer

  const ask = async (question: string) => {
    const text = question.trim();
    if (text.length < 2 || busy) return;
    setBusy(true); setQ("");
    const page = PAGES.find(([re]) => re.test(path))?.[1];
    const r = await postJson<{ answer: string; source: "ai" | "fallback" }>("/api/ai/ask", { question: text, lang, context: page ? `User is on: ${page}` : undefined });
    setBusy(false);
    setTurns((x) => [...x.slice(-9), { q: text, a: r.ok && r.answer ? r.answer : t.errors.generic, source: r.ok ? (r.source ?? "fallback") : "fallback" }]);
  };

  return (
    <>
      {!open && (
        <button ref={btnRef} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog"
          className="btn btn-primary fixed bottom-4 right-4 z-40 rounded-full px-4 shadow-lg print:hidden sm:bottom-6 sm:right-6">
          <MessageCircleQuestion size={20} aria-hidden /> <span className="hidden sm:inline">{s.open}</span><span className="sr-only sm:hidden">{s.open}</span>
        </button>
      )}
      {open && (
        <div role="dialog" aria-modal="false" aria-labelledby="assistant-h"
          className="fixed inset-x-2 bottom-2 z-50 flex max-h-[80vh] flex-col rounded-[6px] border border-line-strong bg-surface shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[24rem]">
          <div className="flex items-start justify-between gap-2 border-b border-line p-4">
            <div>
              <h2 id="assistant-h" className="font-display text-lg font-bold">{s.title}</h2>
              <p className="text-sm text-muted">{s.lead}</p>
            </div>
            <button type="button" className="btn btn-quiet !min-h-0 p-2" onClick={() => { setOpen(false); setTimeout(() => btnRef.current?.focus(), 0); }} aria-label={s.close}><X size={18} aria-hidden /></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {turns.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {s.chips.map((c) => <button key={c} type="button" className="rounded-full border border-line-strong px-3 py-1.5 text-sm font-semibold hover:bg-surface-2" onClick={() => void ask(c)}>{c}</button>)}
              </div>
            )}
            {turns.map((x, i) => (
              <div key={i} className="space-y-1">
                <p className="ml-8 rounded-[4px] bg-accent px-3 py-2 text-accent-contrast">{x.q}</p>
                <div className="mr-8 rounded-[4px] bg-surface-2 px-3 py-2">
                  <p className="whitespace-pre-line">{x.a}</p>
                  <p className="mt-1 text-xs text-muted">{x.source === "ai" ? s.title : s.fallback}</p>
                </div>
              </div>
            ))}
            {busy && <p className="text-sm text-muted">{s.thinking}</p>}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
            <input ref={inputRef} className="input" value={q} maxLength={500} onChange={(e) => setQ(e.target.value)} placeholder={s.ph} aria-label={s.ph} />
            <button type="submit" className="btn btn-primary shrink-0 px-3" disabled={busy || q.trim().length < 2} aria-label={s.send}><Send size={18} aria-hidden /></button>
          </form>
          <p className="px-4 pb-3 text-xs text-muted">{s.note}</p>
        </div>
      )}
    </>
  );
}
