"use client";

import { useState } from "react";
import { useI18n } from "@/components/providers";
import { PhotoInput } from "./photo-input";
import { Consent, postForm, type FormProps, type StatusMap } from "./shared";

/** Register a women-led group: its name, member count, a proof photo and a declaration. */
export function WomenForm({ onDone, errText }: FormProps) {
  const { t } = useI18n();
  const v = t.verify;
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState("");
  const [proof, setProof] = useState<Blob | null>(null);
  const [decl, setDecl] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setErr(null);
    if (groupName.trim().length < 2) return setErr(v.errors.group_name);
    if (!/^\d{1,3}$/.test(members) || Number(members) < 1) return setErr(v.errors.members);
    if (!proof) return setErr(v.errors.file_missing);
    if (!decl) return setErr(v.errors.declaration);
    const fd = new FormData();
    fd.set("groupName", groupName);
    fd.set("members", members);
    fd.set("declaration", "yes");
    fd.set("proof", proof, "proof.jpg");
    setBusy(true);
    const r = await postForm<{ status: StatusMap }>("/api/verification/women-group", fd);
    setBusy(false);
    if (r.ok) onDone(r.status);
    else setErr(errText(r.error));
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="block">
          <span className="field-label">{v.groupName}</span>
          <input
            className="input"
            maxLength={80}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">{v.members}</span>
          <input
            className="input"
            inputMode="numeric"
            maxLength={3}
            value={members}
            onChange={(e) => setMembers(e.target.value.replace(/\D/g, ""))}
          />
        </label>
      </div>
      <PhotoInput
        label={v.proof}
        value={proof}
        onChange={setProof}
        capture="environment"
        required
        chooseLabel={v.choose}
        changeLabel={v.change}
      />
      <Consent name="declaration" label={v.declaration} checked={decl} onChange={setDecl} />
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
