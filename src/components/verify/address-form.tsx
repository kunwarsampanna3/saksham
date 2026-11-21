"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { type FormProps, type StatusMap } from "./shared";

/** Add ward, tole and a landmark to the city and area already set on the profile. */
export function AddressForm({ onDone, errText, city, area }: FormProps & { city: string; area: string }) {
  const { t } = useI18n();
  const v = t.verify;
  const [ward, setWard] = useState("");
  const [tole, setTole] = useState("");
  const [landmark, setLandmark] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setErr(null);
    if (!/^\d{1,2}$/.test(ward)) return setErr(v.errors.ward);
    if (tole.trim().length < 2) return setErr(v.errors.tole);
    setBusy(true);
    const r = await postJson<{ status: StatusMap }>("/api/verification/address", { ward, tole, landmark });
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
      <p className="flex items-center gap-2 text-sm">
        <MapPin size={15} aria-hidden className="text-accent" /> {v.addrFrom(city, area)} ·{" "}
        <Link href="/location" className="text-accent font-semibold hover:underline">
          {v.setLocation}
        </Link>
      </p>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <label className="block">
          <span className="field-label">{v.ward}</span>
          <input
            className="input"
            inputMode="numeric"
            maxLength={2}
            value={ward}
            onChange={(e) => setWard(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="block">
          <span className="field-label">{v.tole}</span>
          <input
            className="input"
            maxLength={80}
            value={tole}
            onChange={(e) => setTole(e.target.value)}
            autoComplete="address-line1"
          />
        </label>
      </div>
      <label className="block">
        <span className="field-label">
          {v.landmark} <span className="text-muted font-normal">({t.common.optional})</span>
        </span>
        <input
          className="input"
          maxLength={80}
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
        />
      </label>
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
