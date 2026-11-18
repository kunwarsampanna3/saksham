"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";

export function ConfirmForm({ token, installmentId, already }: { token: string; installmentId: string; already: boolean | null }) {
  const { t } = useI18n();
  const c = t.confirm;
  const [note, setNote] = useState("");
  const [state, setState] = useState<boolean | null>(already);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async (ok: boolean) => {
    setBusy(true); setErr(null);
    const r = await postJson("/api/confirm", { token, installmentId, ok, note });
    setBusy(false);
    if (r.ok) setState(ok); else setErr(r.error === "invalid" ? c.invalid : t.errors.generic);
  };
  if (state !== null) {
    return <p role="status" className={`mt-2 flex items-center gap-2 font-semibold ${state ? "text-accent" : "text-danger"}`}>{state ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />} {state ? c.done : c.notDone} — {c.thanks}</p>;
  }
  return (
    <div className="mt-3 space-y-3">
      <label className="block"><span className="field-label !text-sm">{c.note}</span>
        <textarea className="input resize-y py-2" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void send(true)}><Check size={18} aria-hidden /> {c.done}</button>
        <button type="button" className="btn btn-ghost flex-1" disabled={busy} onClick={() => void send(false)}><X size={18} aria-hidden /> {c.notDone}</button>
      </div>
      {err && <p role="alert" className="field-error">{err}</p>}
    </div>
  );
}
