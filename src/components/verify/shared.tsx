"use client";

import { useState } from "react";
import { AlertTriangle, Check, Circle, Clock, Trash2 } from "lucide-react";
import type { VerificationKind, VerificationStatus } from "@/lib/store/types";

/** Where each verification step stands, as returned by /api/verification. */
export type StatusEntry = {
  status: VerificationStatus;
  simulated: boolean;
  fields: Record<string, string>;
  note?: string;
  fileIds: { id: string; label: string }[];
};
export type StatusMap = Record<VerificationKind, StatusEntry>;

/** Props every verification form shares. */
export type FormProps = { onDone: (s: StatusMap) => void; errText: (e?: string) => string };

/** POST a FormData (photos and fields) and return the JSON reply, or { ok: false, error: "offline" }. */
export async function postForm<T>(url: string, fd: FormData): Promise<T & { ok: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", body: fd, credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    return { ...(data as T), ok: r.ok && data.ok !== false };
  } catch {
    return { ok: false, error: "offline" } as T & { ok: boolean; error: string };
  }
}

/** Coloured label for verified / pending / rejected / not started. */
export function StatusChip({ status, label }: { status: VerificationStatus; label: string }) {
  const cls = {
    verified: "bg-accent text-accent-contrast",
    pending: "bg-[#fff1cc] text-[#6b4a00] dark:bg-[#3a2c08] dark:text-[#f6d27a]",
    rejected: "bg-danger-soft text-danger",
    not_started: "bg-surface-2 text-muted",
  }[status];
  const Icon = { verified: Check, pending: Clock, rejected: AlertTriangle, not_started: Circle }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-xs font-bold ${cls}`}>
      <Icon size={12} aria-hidden /> {label}
    </span>
  );
}

/** Delete button that asks for confirmation first. */
export function RemoveButton({
  label,
  confirm,
  onRemoved,
}: {
  label: string;
  confirm: string;
  onRemoved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-quiet !text-danger !min-h-9 text-sm"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(confirm)) return;
        setBusy(true);
        await onRemoved();
        setBusy(false);
      }}
    >
      <Trash2 size={15} aria-hidden /> {label}
    </button>
  );
}

/** Consent checkbox shown before a document or photo is sent. */
export function Consent({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span>{label}</span>
    </label>
  );
}
