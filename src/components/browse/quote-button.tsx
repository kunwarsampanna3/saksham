"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, MessageSquareQuote, X } from "lucide-react";
import { useI18n } from "@/components/providers";

/** "Request a quote" opens a short dialog; "Book" goes straight to the post flow with this provider attached. */
export function ProfileActions({ providerId, providerName }: { providerId: string; providerName: string }) {
  const { t } = useI18n();
  const p = t.profile;
  const router = useRouter();
  const dlg = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    if (open) dlg.current?.showModal();
    else dlg.current?.close();
  }, [open]);

  const go = (mode: "quote" | "book", body = "") => {
    try {
      sessionStorage.setItem(
        "sk_draft",
        JSON.stringify({ text: body, providerId, providerName, mode, at: Date.now() }),
      );
    } catch {
      /* ignore */
    }
    router.push(`/post?provider=${encodeURIComponent(providerId)}&mode=${mode}`);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
          <MessageSquareQuote size={18} aria-hidden /> {p.quote}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => go("book")}>
          <CalendarCheck size={18} aria-hidden /> {p.book}
        </button>
      </div>
      <dialog
        ref={dlg}
        onClose={() => setOpen(false)}
        aria-labelledby="quote-h"
        className="border-line bg-surface text-text backdrop:bg-ink/60 m-auto w-[min(30rem,calc(100vw-2rem))] rounded-md border p-0"
      >
        <form
          method="dialog"
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim().length > 3) go("quote", text.trim());
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id="quote-h" className="font-display text-2xl font-bold">
              {p.quoteTitle}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t.common.close}
              className="hover:bg-accent-soft inline-flex h-9 w-9 items-center justify-center rounded-md"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          <p className="text-muted mt-1 text-sm">{providerName}</p>
          <p className="text-muted mt-3">{p.quoteLead}</p>
          <label htmlFor="quote-t" className="sr-only">
            {p.quoteTitle}
          </label>
          <textarea
            id="quote-t"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            rows={4}
            autoFocus
            placeholder={p.quotePh}
            className="input mt-4 resize-y py-3"
          />
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </button>
            <button type="submit" className="btn btn-primary" disabled={text.trim().length < 4}>
              {p.send}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
