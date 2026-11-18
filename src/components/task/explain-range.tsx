"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";

/** "Explain this range": Claude words the explanation; the numbers and basis come from the price table. */
export function ExplainRange({ taskId }: { taskId: string }) {
  const { t, lang } = useI18n();
  const k = t.task;
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ text: string | null; basis: string[] } | null>(null);
  return (
    <div>
      <button type="button" className="btn btn-quiet -ml-2 text-sm" disabled={busy} onClick={async () => {
        setBusy(true);
        const r = await postJson<{ text: string | null; basis: string[] }>("/api/ai/explain-range", { taskId, lang });
        setBusy(false);
        if (r.ok) setOut({ text: r.text, basis: r.basis });
      }}>
        <Sparkles size={15} aria-hidden /> {busy ? k.explaining : k.explain}
      </button>
      {out && (
        <div className="mt-2 rounded-[4px] bg-surface-2 p-3 text-sm" aria-live="polite">
          {out.text && <p>{out.text}</p>}
          <ul className="mt-1.5 list-disc pl-5 text-muted">{out.basis.map((b) => <li key={b}>{b}</li>)}</ul>
          <p className="mt-1.5 text-xs font-semibold">{k.fromTable}</p>
        </div>
      )}
    </div>
  );
}
