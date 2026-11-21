"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";

type Topic = "help" | "payment" | "account" | "feedback";

/** Sends a message to the Saksham team. It lands in the admin queue (/admin → Reports). */
export function ContactForm() {
  const { t } = useI18n();
  const c = t.contactPage;
  const [topic, setTopic] = useState<Topic>("help");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (msg.trim().length < 10) {
      setErr(t.home.hero.tooShort);
      return;
    }
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/safety", {
      action: "report",
      reason: "other",
      details: `[Contact · ${c.topics[topic]}] ${msg.trim()}`,
    });
    setBusy(false);
    if (r.ok) {
      setDone(true);
      setMsg("");
    } else setErr(t.errors.generic);
  };

  return (
    <section aria-labelledby="form-h" className="notch-frame">
      <form onSubmit={send} className="notch-card terrace-edge space-y-5 p-6">
        <h2 id="form-h" className="font-display text-2xl font-bold">
          {c.formTitle}
        </h2>
        <label className="block">
          <span className="field-label">{c.topic}</span>
          <select className="input" value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>
            {(Object.keys(c.topics) as Topic[]).map((k) => (
              <option key={k} value={k}>
                {c.topics[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">{c.message}</span>
          <textarea
            className="input resize-y py-3"
            rows={6}
            maxLength={1900}
            value={msg}
            placeholder={c.messagePh}
            onChange={(e) => {
              setMsg(e.target.value);
              setDone(false);
            }}
            required
            minLength={10}
          />
        </label>
        {err && (
          <p role="alert" className="field-error">
            {err}
          </p>
        )}
        {done && (
          <p role="status" className="text-accent font-semibold">
            {c.sent}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Send size={18} aria-hidden /> {c.send}
        </button>
      </form>
    </section>
  );
}
