"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { PhotoInput } from "./photo-input";
import { BACK_OPTIONAL, type DocType } from "@/lib/roles";
import { Consent, postForm, type FormProps, type StatusMap } from "./shared";

/** Upload an ID document (front, and back when the document has one). */
export function IdForm({ onDone, errText, docs }: FormProps & { docs: readonly DocType[] }) {
  const { t } = useI18n();
  const v = t.verify;
  const [docType, setDocType] = useState<DocType>(docs[0]);
  const [front, setFront] = useState<Blob | null>(null);
  const [back, setBack] = useState<Blob | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const backRequired = !BACK_OPTIONAL.includes(docType);

  const send = async () => {
    setErr(null);
    if (!front || (backRequired && !back)) return setErr(v.errors.file_missing);
    if (!consent) return setErr(v.errors.consent);
    const fd = new FormData();
    fd.set("docType", docType);
    fd.set("consent", "yes");
    fd.set("front", front, "front.jpg");
    if (back) fd.set("back", back, "back.jpg");
    setBusy(true);
    const r = await postForm<{ status: StatusMap }>("/api/verification/id", fd);
    setBusy(false);
    if (r.ok) onDone(r.status);
    else setErr(errText(r.error));
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      noValidate
    >
      <fieldset>
        <legend className="field-label">{v.docType}</legend>
        <div className="flex flex-wrap gap-2">
          {docs.map((d) => (
            <label
              key={d}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 text-[0.95rem] font-semibold ${docType === d ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}
            >
              <input
                type="radio"
                name="docType"
                value={d}
                checked={docType === d}
                onChange={() => setDocType(d)}
                className="accent-[var(--accent)]"
              />{" "}
              {v.docTypes[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <PhotoInput
          label={v.front}
          value={front}
          onChange={setFront}
          capture="environment"
          required
          chooseLabel={v.choose}
          changeLabel={v.change}
        />
        <PhotoInput
          label={backRequired ? v.back : v.backOptional}
          value={back}
          onChange={setBack}
          capture="environment"
          required={backRequired}
          chooseLabel={v.choose}
          changeLabel={v.change}
        />
      </div>
      <Consent name="consent" label={v.consentId} checked={consent} onChange={setConsent} />
      {err && (
        <p role="alert" className="field-error">
          {err}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? v.sending : v.submit}
      </button>
    </form>
  );
}
