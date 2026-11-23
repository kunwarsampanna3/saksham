"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/components/providers";
import { useReauth } from "@/components/reauth-dialog";

const ERRORS: Record<string, string> = {
  already_decided: "Someone already decided this. The page has been refreshed.",
  already_on_hold: "This is already on hold.",
  not_on_hold: "This isn't on hold any more.",
  booking_closed: "This booking is finished, so there's nothing left to hold.",
  own_payout: "You can't decide your own withdrawal.",
  own_booking: "You're part of this booking, so you can't decide on it.",
  protected: "The demo admin can only act on demo accounts.",
  public_demo: "Site settings can't be changed on the open public demo.",
  reason: "Please give a reason (at least 3 characters).",
  no_dispute: "This dispute is already resolved.",
  already_seeded: "Sample bookings are already there. Use Admin → Reset demo to start again.",
  reauth_required: "Please confirm with your MPIN.",
  suspended: "That account is suspended.",
  rate_limited: "Too many actions. Wait a minute.",
  offline: "You're offline.",
  not_found: "Not found, or you don't have access.",
};

/**
 * A button for a sensitive action. It opens a confirmation that says exactly what will happen, asks for a reason
 * when one is needed, checks the MPIN for money actions, then calls /api/superadmin and refreshes the page.
 */
export function ConfirmAction({
  label,
  title,
  summary,
  body,
  confirmLabel,
  tone = "primary",
  needReason = false,
  money = true,
  small = true,
  disabled,
}: {
  label: ReactNode;
  title: string;
  summary: ReactNode;
  body: Record<string, unknown>;
  confirmLabel: string;
  tone?: "primary" | "danger" | "ghost";
  needReason?: boolean;
  /** Ask for a fresh MPIN first */
  money?: boolean;
  small?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { ensureFresh, dialog } = useReauth();
  const reasonId = useId();

  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);

  const submit = async () => {
    if (needReason && reason.trim().length < 3) return setErr(ERRORS.reason);
    setBusy(true);
    setErr(null);
    if (money && !(await ensureFresh())) return setBusy(false);
    const payload = { ...body, ...(needReason || "reason" in body ? { reason: reason.trim() } : {}) };
    let r = await postJson<{ ref?: string }>("/api/superadmin", payload);
    if (!r.ok && r.error === "reauth_required" && (await ensureFresh()))
      r = await postJson<{ ref?: string }>("/api/superadmin", payload);
    setBusy(false);
    if (!r.ok) {
      setErr(ERRORS[r.error ?? ""] ?? "That didn't work. Please try again.");
      if (r.error === "already_decided" || r.error === "no_dispute") router.refresh();
      return;
    }
    setOpen(false);
    setReason("");
    setDone("Done");
    router.refresh();
    setTimeout(() => setDone(null), 2500);
  };

  const btn = tone === "danger" ? "btn-danger" : tone === "ghost" ? "btn-ghost" : "btn-primary";
  return (
    <>
      <button
        type="button"
        className={`btn ${btn} ${small ? "!min-h-9 !px-3 text-xs" : "text-sm"}`}
        onClick={() => {
          setErr(null);
          setOpen(true);
        }}
        disabled={disabled}
      >
        {label}
      </button>
      {done && (
        <span role="status" className="text-xs font-semibold text-[var(--ok-text)]">
          {done}
        </span>
      )}
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        className="bg-surface text-text border-line m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border p-0 shadow-xl backdrop:bg-black/50"
        aria-labelledby={`${reasonId}-t`}
      >
        <div className="p-5">
          <h2 id={`${reasonId}-t`} className="text-lg font-bold">
            {title}
          </h2>
          <div className="text-muted mt-2 text-sm">{summary}</div>
          {needReason && (
            <label htmlFor={reasonId} className="mt-4 block text-sm font-semibold">
              Reason (saved in the audit log{tone === "danger" ? " and shown to the person" : ""})
              <textarea
                id={reasonId}
                className="input mt-1 min-h-20 w-full"
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          )}
          {err && (
            <p role="alert" className="field-error mt-3">
              {err}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost text-sm"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${btn === "btn-ghost" ? "btn-primary" : btn} text-sm`}
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
          {money && (
            <p className="text-muted mt-3 text-xs">
              Money actions ask for your MPIN if you haven&apos;t entered it in the last 5 minutes.
            </p>
          )}
        </div>
      </dialog>
      {dialog}
    </>
  );
}
