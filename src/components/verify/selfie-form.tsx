"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, ScanFace } from "lucide-react";
import { useI18n, useUser } from "@/components/providers";
import { PhotoInput } from "./photo-input";
import { SelfieCamera } from "./selfie-camera";
import { Consent, postForm, type FormProps, type StatusMap } from "./shared";

/** Take a live selfie that is matched against the ID photo. */
export function SelfieForm({
  onDone,
  errText,
  demoMode,
  faceMatch,
}: FormProps & { demoMode: boolean; faceMatch: boolean }) {
  const { t } = useI18n();
  const v = t.verify;
  const isDemo = !!useUser().user?.isDemo;
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [camera, setCamera] = useState(false);
  const [denied, setDenied] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Decided after mount: the server can't know whether this device has a camera (avoids a hydration mismatch).
  const [hasCamera, setHasCamera] = useState(false);
  useEffect(() => setHasCamera(!!navigator.mediaDevices?.getUserMedia), []);
  const onDenied = useCallback(() => {
    setDenied(true);
    setCamera(false);
  }, []);

  const send = async () => {
    setErr(null);
    if (!selfie) return setErr(v.errors.file_missing);
    if (!consent) return setErr(v.errors.consent);
    const fd = new FormData();
    fd.set("consent", "yes");
    fd.set("selfie", selfie, "selfie.jpg");
    setBusy(true);
    const r = await postForm<{ status: StatusMap }>("/api/verification/selfie", fd);
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
      <p className="text-muted text-sm">{v.selfieTips}</p>
      {demoMode && isDemo ? (
        <p className="flex items-center gap-2 text-sm">
          <span className="demo-tag">{v.simulated}</span> {v.selfieSim}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-sm">
          <ScanFace size={16} aria-hidden className="text-accent mt-0.5 shrink-0" />{" "}
          {faceMatch ? v.selfieReal : v.selfieReview}
        </p>
      )}
      {camera ? (
        <SelfieCamera
          labels={{ capture: v.capture, close: v.closeCamera }}
          onCapture={setSelfie}
          onClose={() => setCamera(false)}
          onDenied={onDenied}
        />
      ) : (
        <div className="flex flex-wrap items-end gap-4">
          {hasCamera && !denied && (
            <button type="button" className="btn btn-ghost" onClick={() => setCamera(true)}>
              <Camera size={18} aria-hidden /> {v.camera}
            </button>
          )}
          <PhotoInput
            label={hasCamera && !denied ? v.upload : v.steps.selfie.title}
            value={selfie}
            onChange={setSelfie}
            capture="user"
            chooseLabel={v.choose}
            changeLabel={v.change}
          />
        </div>
      )}
      {denied && <p className="text-danger text-sm">{v.cameraDenied}</p>}
      <Consent name="consent" label={v.consentSelfie} checked={consent} onChange={setConsent} />
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
