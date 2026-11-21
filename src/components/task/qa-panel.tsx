"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import type { QA } from "./live-types";

/** Public questions about a task: providers ask, the task owner answers. */
export function QAPanel({
  taskId,
  owner,
  questions,
  onDone,
  errText,
}: {
  taskId: string;
  owner: boolean;
  questions: QA[];
  onDone: () => Promise<void>;
  errText: (e?: string) => string;
}) {
  const { t } = useI18n();
  const k = t.task;
  const [body, setBody] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    const r = await postJson(`/api/tasks/${taskId}/questions`, payload);
    setBusy(false);
    if (!r.ok) {
      setErr(errText(r.error));
      return false;
    }
    await onDone();
    return true;
  };

  return (
    <section aria-labelledby="qa-h">
      <h2 id="qa-h" className="font-display flex items-center gap-2 text-2xl font-bold">
        <MessageCircleQuestion size={22} aria-hidden className="text-accent" /> {k.qa}
      </h2>
      <p className="text-muted mt-1 text-sm">{k.qaLead}</p>
      {questions.length === 0 ? (
        <p className="text-muted mt-4">{k.noQuestions}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {questions.map((q) => (
            <li key={q.id} className="border-line-strong bg-surface border-l-4 p-4">
              <p>
                <strong>{q.askerName}:</strong> {q.body}
              </p>
              {q.answer ? (
                <p className="border-leaf mt-2 border-l-4 pl-3">
                  <strong>↳</strong> {q.answer}
                </p>
              ) : owner ? (
                <form
                  className="mt-2 flex flex-wrap gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await post({ action: "answer", questionId: q.id, text: answers[q.id] ?? "" }))
                      setAnswers((a) => ({ ...a, [q.id]: "" }));
                  }}
                >
                  <label className="sr-only" htmlFor={`a-${q.id}`}>
                    {k.answer}
                  </label>
                  <input
                    id={`a-${q.id}`}
                    className="input !min-h-10 flex-1"
                    maxLength={1000}
                    placeholder={k.answerPh}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                  <button
                    type="submit"
                    className="btn btn-ghost !min-h-10"
                    disabled={busy || !(answers[q.id] ?? "").trim()}
                  >
                    {k.answer}
                  </button>
                </form>
              ) : (
                <p className="text-muted mt-1 text-sm">{k.awaiting}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {!owner && (
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await post({ action: "ask", body })) setBody("");
          }}
        >
          <label className="sr-only" htmlFor="qa-ask">
            {k.ask}
          </label>
          <input
            id="qa-ask"
            className="input flex-1"
            maxLength={500}
            placeholder={k.askPh}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button type="submit" className="btn btn-ghost" disabled={busy || body.trim().length < 2}>
            {k.askSend}
          </button>
        </form>
      )}
      {err && (
        <p role="alert" className="field-error mt-2">
          {err}
        </p>
      )}
    </section>
  );
}
