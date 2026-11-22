"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, useI18n } from "@/components/providers";
import type { SiteControls } from "@/lib/store/types";

function useManage() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const errors: Record<string, string> = t.adminDash.actions.errors;
  const run = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/admin/manage", body);
    setBusy(false);
    if (!r.ok) {
      setErr((r.error && errors[r.error]) || t.errors.generic);
      return false;
    }
    router.refresh();
    return true;
  };
  return { busy, err, setErr, run };
}

/** A button that changes something. Suspending and taking down ask for a reason first. */
export function ManageButton({
  body,
  label,
  needsReason = false,
  danger = false,
}: {
  body: Record<string, unknown>;
  label: string;
  needsReason?: boolean;
  danger?: boolean;
}) {
  const { t } = useI18n();
  const a = t.adminDash.actions;
  const { busy, err, setErr, run } = useManage();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="inline-block align-top">
      {asking ? (
        <form
          className="w-64 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (reason.trim().length < 3) return setErr(a.errors.reason);
            if (await run({ ...body, reason: reason.trim() })) setAsking(false);
          }}
        >
          <label className="block">
            <span className="text-xs font-semibold">{a.reason}</span>
            <input
              name="reason"
              className="input !min-h-10"
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-danger !min-h-9 text-sm" disabled={busy}>
            {a.confirm}
          </button>{" "}
          <button type="button" className="btn btn-quiet !min-h-9 text-sm" onClick={() => setAsking(false)}>
            {a.cancel}
          </button>
        </form>
      ) : (
        <button
          type="button"
          className={`btn btn-ghost !min-h-9 text-sm ${danger ? "!text-danger" : ""}`}
          disabled={busy}
          onClick={() => (needsReason ? setAsking(true) : void run(body))}
        >
          {label}
        </button>
      )}
      {err && (
        <p role="alert" className="field-error mt-1 max-w-64 whitespace-normal">
          {err}
        </p>
      )}
    </div>
  );
}

const SWITCHES = ["signups", "posting", "applying", "maintenance"] as const;

export function ControlsForm({ initial }: { initial: SiteControls }) {
  const { t } = useI18n();
  const d = t.adminDash.traffic;
  const { busy, err, setErr, run } = useManage();
  const [on, setOn] = useState({
    signups: initial.signups,
    posting: initial.posting,
    applying: initial.applying,
    maintenance: initial.maintenance,
  });
  const [max, setMax] = useState(String(initial.maxOnline));
  const [saved, setSaved] = useState(false);

  return (
    <form
      data-controls
      onChange={() => setSaved(false)}
      onSubmit={async (e) => {
        e.preventDefault();
        const maxOnline = Number(max || 0);
        if (!Number.isInteger(maxOnline) || maxOnline < 0 || maxOnline > 100_000)
          return setErr(t.adminDash.actions.errors.max_online);
        setSaved(await run({ action: "controls", ...on, maxOnline }));
      }}
    >
      <ul className="divide-line divide-y">
        {SWITCHES.map((key) => (
          <li key={key}>
            <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
              <span>
                <span className="block font-semibold">{d.switches[key].t}</span>
                <span className="text-muted block text-sm">{d.switches[key].b}</span>
              </span>
              <input
                name={key}
                type="checkbox"
                role="switch"
                checked={on[key]}
                onChange={(e) => setOn((v) => ({ ...v, [key]: e.target.checked }))}
                className={`h-6 w-6 shrink-0 ${key === "maintenance" ? "accent-[var(--danger)]" : "accent-[var(--accent)]"}`}
              />
            </label>
          </li>
        ))}
      </ul>
      <label className="mt-3 block max-w-xs">
        <span className="field-label">{d.maxOnline}</span>
        <input
          name="maxOnline"
          className="input"
          type="number"
          min={0}
          max={100000}
          value={max}
          onChange={(e) => setMax(e.target.value)}
        />
        <span className="field-hint">{d.maxOnlineHelp}</span>
      </label>
      {err && (
        <p role="alert" className="field-error mt-2">
          {err}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {d.save}
        </button>
        {saved && (
          <span role="status" className="text-accent font-semibold">
            {d.saved}
          </span>
        )}
      </div>
    </form>
  );
}
