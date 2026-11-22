"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Eye,
  FlaskConical,
  Home,
  IdCard,
  MapPin,
  ScanFace,
  ShieldCheck,
  Smartphone,
  Unlock,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { postJson, useI18n, useUser } from "@/components/providers";
import type { VerificationKind } from "@/lib/store/types";
import { KYC_DOCS, type KycRole } from "@/lib/roles";
import { RemoveButton, StatusChip, type StatusMap } from "./shared";
import { AddressForm } from "./address-form";
import { IdForm } from "./id-form";
import { SelfieForm } from "./selfie-form";
import { WomenForm } from "./women-form";

export type { StatusMap } from "./shared";

const ICONS: Record<VerificationKind, LucideIcon> = {
  phone: Smartphone,
  id: IdCard,
  selfie: ScanFace,
  address: Home,
  womenGroup: Users,
};

/** The verification page: phone, ID, selfie, address and women-group steps with their status. */
export function VerificationCenter({
  initial,
  demoMode,
  faceMatch,
  role,
  city,
  area,
}: {
  initial: StatusMap;
  demoMode: boolean;
  faceMatch: boolean;
  role: KycRole;
  city: string;
  area?: string;
}) {
  const { t } = useI18n();
  const v = t.verify;
  const router = useRouter();
  const { user, setUser } = useUser();
  const [status, setStatus] = useState<StatusMap>(initial);
  const [open, setOpen] = useState<VerificationKind | null>(
    () =>
      (["id", "selfie", "address"] as const).find(
        (k) => initial[k].status === "not_started" || initial[k].status === "rejected",
      ) ?? null,
  );

  const errText = (e?: string) =>
    e && e in v.errors
      ? v.errors[e as keyof typeof v.errors]
      : e === "offline"
        ? t.errors.offline
        : t.errors.generic;

  const apply = useCallback(
    (s: StatusMap | null | undefined) => {
      if (!s) return;
      setStatus(s);
      const verified = s.id.status === "verified" && s.selfie.status === "verified";
      const womenLed = s.womenGroup.status === "verified";
      if (user && (user.verified !== verified || user.womenLed !== womenLed))
        setUser({ ...user, verified, womenLed });
      router.refresh();
    },
    [router, user, setUser],
  );

  const done = (["phone", "id", "selfie"] as const).filter((k) => status[k].status === "verified").length;
  // Client form: ID, selfie, address. Provider and "both" forms add the women-led group check.
  const kinds: VerificationKind[] = [
    "phone",
    "id",
    "selfie",
    "address",
    ...(role !== "client" ? (["womenGroup"] as const) : []),
  ];
  const need = (k: VerificationKind) =>
    k === "id" || k === "selfie" ? "required" : k === "phone" ? null : "optional";

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-8">
        {/* Stamp progress — three terraces */}
        <section aria-labelledby="stamp-h" className="notch-frame">
          <div className="notch-card terrace-edge p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="stamp-h" className="font-display text-xl font-bold">
                  {v.stampTitle}
                </h2>
                <p className="text-muted">{v.stampLead}</p>
              </div>
              {done === 3 ? (
                <span className="stamp text-base">
                  <ShieldCheck size={16} aria-hidden /> {v.stampOn}
                </span>
              ) : (
                <span className="text-muted text-sm font-semibold">{v.stampOff(done)}</span>
              )}
            </div>
            <ol className="mt-5 flex items-end gap-1.5" aria-label={v.stampTitle}>
              {(["phone", "id", "selfie"] as const).map((k, i) => {
                const st = status[k].status;
                return (
                  <li key={k} className="flex-1">
                    <div
                      className={`${st === "verified" ? "bg-accent" : st === "pending" ? "bg-marigold" : "bg-line"}`}
                      style={{ height: `${10 + i * 8}px` }}
                      aria-hidden
                    />
                    <span className="mt-1.5 block text-xs font-semibold">
                      {v.steps[k].title}
                      <span className="sr-only">: {v.status[st]}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <ol className="mt-8 space-y-4">
          {kinds.map((k, i) => {
            const s = status[k];
            const Icon = ICONS[k];
            const step = v.steps[k];
            const expanded = open === k;
            const canAct = k !== "phone" && (s.status === "not_started" || s.status === "rejected");
            return (
              <li key={k} className="notch-frame">
                <section
                  aria-labelledby={`st-${k}`}
                  className="notch-card p-5 sm:p-6"
                  style={{
                    boxShadow: `inset ${4 + i * 2}px 0 0 0 ${s.status === "verified" ? "var(--accent)" : s.status === "pending" ? "var(--marigold)" : s.status === "rejected" ? "var(--danger)" : "var(--line)"}`,
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
                    <div className="flex items-start gap-3">
                      <span className="bg-accent-soft text-accent inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px]">
                        <Icon size={22} aria-hidden />
                      </span>
                      <div>
                        <h3
                          id={`st-${k}`}
                          className="font-display flex flex-wrap items-center gap-2 text-lg font-bold"
                        >
                          {k === "id" ? v.idTitleBy[role] : step.title}
                          {need(k) === "required" && (
                            <span className="bg-danger-soft text-danger rounded-[3px] px-1.5 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase">
                              {v.required}
                            </span>
                          )}
                          {need(k) === "optional" && (
                            <span className="bg-surface-2 text-muted rounded-[3px] px-1.5 py-0.5 text-[0.7rem] font-bold tracking-wide uppercase">
                              {v.optional}
                            </span>
                          )}
                        </h3>
                        <p className="text-muted text-[0.95rem]">{step.body}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.simulated && (
                        <span className="demo-tag">
                          <FlaskConical size={11} aria-hidden /> {v.simulated}
                        </span>
                      )}
                      <StatusChip status={s.status} label={v.status[s.status]} />
                    </div>
                  </div>

                  <p className="mt-3 flex items-start gap-2 pl-2 text-sm">
                    <Unlock size={15} aria-hidden className="text-accent mt-0.5 shrink-0" />{" "}
                    <span>
                      <strong>{v.unlocks}:</strong> {v.unlocksBy[role][k] || step.unlocks}
                    </span>
                  </p>
                  {s.status === "rejected" && s.note && (
                    <p className="text-danger mt-2 pl-2 text-sm">
                      <strong>{v.note}:</strong> {s.note}
                    </p>
                  )}

                  {/* files + remove */}
                  {(s.fileIds.length > 0 || (k !== "phone" && s.status !== "not_started")) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-2">
                      {s.fileIds.map((f) => (
                        <a
                          key={f.id}
                          href={`/api/verification/file/${f.id}`}
                          target="_blank"
                          rel="noopener"
                          className="btn btn-quiet !min-h-9 text-sm"
                        >
                          <Eye size={15} aria-hidden /> {v.view} ({f.label})
                        </a>
                      ))}
                      {k !== "phone" && (
                        <RemoveButton
                          label={v.remove}
                          confirm={v.removeConfirm}
                          onRemoved={async () => {
                            const r = await postJson<{ status: StatusMap }>("/api/verification/withdraw", {
                              kind: k,
                            });
                            if (r.ok) {
                              apply(r.status);
                              setOpen(k);
                            }
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* demo reviewer */}
                  {s.status === "pending" && !user?.isDemo && k !== "phone" && (
                    <p className="text-muted mt-3 flex items-start gap-2 pl-2 text-sm">
                      <Clock size={15} aria-hidden className="text-marigold mt-0.5 shrink-0" />{" "}
                      {v.pendingReal}
                    </p>
                  )}
                  {demoMode && user?.isDemo && s.status === "pending" && (
                    <div className="mt-4 rounded-[4px] border border-dashed border-[#c58a00] bg-[#fff8e6] p-3 text-[#4d3500] dark:bg-[#2c2208] dark:text-[#f6d27a]">
                      <p className="flex items-center gap-2 text-sm">
                        <span className="demo-tag">{t.common.demo}</span> {v.demoNote}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn btn-primary !min-h-10"
                          onClick={async () => {
                            const r = await postJson<{ status: StatusMap }>("/api/verification/review", {
                              kind: k,
                              decision: "verified",
                            });
                            if (r.ok) apply(r.status);
                          }}
                        >
                          <Check size={16} aria-hidden /> {v.demoApprove}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost !min-h-10"
                          onClick={async () => {
                            const r = await postJson<{ status: StatusMap }>("/api/verification/review", {
                              kind: k,
                              decision: "rejected",
                              note: "Photo was blurry (demo)",
                            });
                            if (r.ok) apply(r.status);
                          }}
                        >
                          {v.demoReject}
                        </button>
                      </div>
                    </div>
                  )}

                  {canAct && (
                    <div className="mt-4 pl-2">
                      {!expanded ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-expanded={false}
                          onClick={() => setOpen(k)}
                        >
                          {t.common.continue}
                        </button>
                      ) : (
                        <div className="border-line border-t pt-4">
                          {k === "id" && <IdForm onDone={apply} errText={errText} docs={KYC_DOCS[role]} />}
                          {k === "selfie" &&
                            (status.id.status === "not_started" || status.id.status === "rejected" ? (
                              <p className="text-danger text-sm font-semibold">{v.errors.id_first}</p>
                            ) : (
                              <SelfieForm
                                onDone={apply}
                                errText={errText}
                                demoMode={demoMode}
                                faceMatch={faceMatch}
                              />
                            ))}
                          {k === "address" &&
                            (area ? (
                              <AddressForm onDone={apply} errText={errText} city={city} area={area} />
                            ) : (
                              <p className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-danger">{v.needLocation}</span>{" "}
                                <Link href="/location" className="btn btn-quiet">
                                  <MapPin size={15} aria-hidden /> {v.setLocation}
                                </Link>
                              </p>
                            ))}
                          {k === "womenGroup" && <WomenForm onDone={apply} errText={errText} />}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </li>
            );
          })}
        </ol>
      </div>

      <aside className="lg:col-span-4">
        <section
          aria-labelledby="priv-h"
          className="bg-forest relative overflow-hidden rounded-[4px] p-5 text-[#d9e8dd] lg:sticky lg:top-[calc(var(--header-h)+16px)]"
        >
          <h2 id="priv-h" className="font-display flex items-center gap-2 text-xl font-bold text-white">
            <ShieldCheck size={20} aria-hidden className="text-leaf" /> {v.privacyTitle}
          </h2>
          <ul className="mt-3 space-y-2.5 text-[0.95rem]">
            {v.privacy.map((p) => (
              <li key={p} className="flex gap-2">
                <Check size={16} aria-hidden className="text-leaf mt-1 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
