"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Smartphone, IdCard, ScanFace, Home, Users, Unlock, Check, Clock, AlertTriangle, Circle, Camera, Trash2, Eye, FlaskConical, MapPin, ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { postJson, useI18n, useUser } from "@/components/providers";
import { PhotoInput } from "./photo-input";
import { SelfieCamera } from "./selfie-camera";
import type { VerificationKind, VerificationStatus } from "@/lib/store/types";
import { BACK_OPTIONAL, KYC_DOCS, type DocType, type KycRole } from "@/lib/roles";

type StatusEntry = { status: VerificationStatus; simulated: boolean; fields: Record<string, string>; note?: string; fileIds: { id: string; label: string }[] };
export type StatusMap = Record<VerificationKind, StatusEntry>;

const ICONS: Record<VerificationKind, LucideIcon> = { phone: Smartphone, id: IdCard, selfie: ScanFace, address: Home, womenGroup: Users };

async function postForm<T>(url: string, fd: FormData): Promise<T & { ok: boolean; error?: string }> {
  try {
    const r = await fetch(url, { method: "POST", body: fd, credentials: "same-origin" });
    const data = await r.json().catch(() => ({}));
    return { ...(data as T), ok: r.ok && data.ok !== false };
  } catch {
    return { ok: false, error: "offline" } as T & { ok: boolean; error: string };
  }
}

export function VerificationCenter({
  initial, demoMode, role, city, area,
}: { initial: StatusMap; demoMode: boolean; role: KycRole; city: string; area?: string }) {
  const { t } = useI18n();
  const v = t.verify;
  const router = useRouter();
  const { user, setUser } = useUser();
  const [status, setStatus] = useState<StatusMap>(initial);
  const [open, setOpen] = useState<VerificationKind | null>(() => (["id", "selfie", "address"] as const).find((k) => initial[k].status === "not_started" || initial[k].status === "rejected") ?? null);

  const errText = (e?: string) => (e && e in v.errors ? v.errors[e as keyof typeof v.errors] : e === "offline" ? t.errors.offline : t.errors.generic);

  const apply = useCallback((s: StatusMap | null | undefined) => {
    if (!s) return;
    setStatus(s);
    const verified = s.id.status === "verified" && s.selfie.status === "verified";
    const womenLed = s.womenGroup.status === "verified";
    if (user && (user.verified !== verified || user.womenLed !== womenLed)) setUser({ ...user, verified, womenLed });
    router.refresh();
  }, [router, user, setUser]);

  const done = (["phone", "id", "selfie"] as const).filter((k) => status[k].status === "verified").length;
  // Client form: ID, selfie, address. Provider and "both" forms add the women-led group check.
  const kinds: VerificationKind[] = ["phone", "id", "selfie", "address", ...(role !== "client" ? (["womenGroup"] as const) : [])];
  const need = (k: VerificationKind) => (k === "id" || k === "selfie" ? "required" : k === "phone" ? null : "optional");

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-8">
        {/* Stamp progress — three terraces */}
        <section aria-labelledby="stamp-h" className="notch-frame">
          <div className="notch-card terrace-edge p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="stamp-h" className="font-display text-xl font-bold">{v.stampTitle}</h2>
                <p className="text-muted">{v.stampLead}</p>
              </div>
              {done === 3 ? <span className="stamp text-base"><ShieldCheck size={16} aria-hidden /> {v.stampOn}</span>
                : <span className="text-sm font-semibold text-muted">{v.stampOff(done)}</span>}
            </div>
            <ol className="mt-5 flex items-end gap-1.5" aria-label={v.stampTitle}>
              {(["phone", "id", "selfie"] as const).map((k, i) => {
                const st = status[k].status;
                return (
                  <li key={k} className="flex-1">
                    <div className={`${st === "verified" ? "bg-accent" : st === "pending" ? "bg-marigold" : "bg-line"}`} style={{ height: `${10 + i * 8}px` }} aria-hidden />
                    <span className="mt-1.5 block text-xs font-semibold">{v.steps[k].title}<span className="sr-only">: {v.status[st]}</span></span>
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
                <section aria-labelledby={`st-${k}`} className="notch-card p-5 sm:p-6" style={{ boxShadow: `inset ${4 + i * 2}px 0 0 0 ${s.status === "verified" ? "var(--accent)" : s.status === "pending" ? "var(--marigold)" : s.status === "rejected" ? "var(--danger)" : "var(--line)"}` }}>
                  <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-accent-soft text-accent"><Icon size={22} aria-hidden /></span>
                      <div>
                        <h3 id={`st-${k}`} className="font-display flex flex-wrap items-center gap-2 text-lg font-bold">
                          {k === "id" ? v.idTitleBy[role] : step.title}
                          {need(k) === "required" && <span className="rounded-[3px] bg-danger-soft px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-danger">{v.required}</span>}
                          {need(k) === "optional" && <span className="rounded-[3px] bg-surface-2 px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-muted">{v.optional}</span>}
                        </h3>
                        <p className="text-[0.95rem] text-muted">{step.body}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.simulated && <span className="demo-tag"><FlaskConical size={11} aria-hidden /> {v.simulated}</span>}
                      <StatusChip status={s.status} label={v.status[s.status]} />
                    </div>
                  </div>

                  <p className="mt-3 flex items-start gap-2 pl-2 text-sm"><Unlock size={15} aria-hidden className="mt-0.5 shrink-0 text-accent" /> <span><strong>{v.unlocks}:</strong> {v.unlocksBy[role][k] || step.unlocks}</span></p>
                  {s.status === "rejected" && s.note && <p className="mt-2 pl-2 text-sm text-danger"><strong>{v.note}:</strong> {s.note}</p>}

                  {/* files + remove */}
                  {(s.fileIds.length > 0 || (k !== "phone" && s.status !== "not_started")) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 pl-2">
                      {s.fileIds.map((f) => (
                        <a key={f.id} href={`/api/verification/file/${f.id}`} target="_blank" rel="noopener" className="btn btn-quiet !min-h-9 text-sm">
                          <Eye size={15} aria-hidden /> {v.view} ({f.label})
                        </a>
                      ))}
                      {k !== "phone" && (
                        <RemoveButton label={v.remove} confirm={v.removeConfirm} onRemoved={async () => {
                          const r = await postJson<{ status: StatusMap }>("/api/verification/withdraw", { kind: k });
                          if (r.ok) { apply(r.status); setOpen(k); }
                        }} />
                      )}
                    </div>
                  )}

                  {/* demo reviewer */}
                  {demoMode && s.status === "pending" && (
                    <div className="mt-4 rounded-[4px] border border-dashed border-[#c58a00] bg-[#fff8e6] p-3 text-[#4d3500] dark:bg-[#2c2208] dark:text-[#f6d27a]">
                      <p className="flex items-center gap-2 text-sm"><span className="demo-tag">{t.common.demo}</span> {v.demoNote}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" className="btn btn-primary !min-h-10" onClick={async () => {
                          const r = await postJson<{ status: StatusMap }>("/api/verification/review", { kind: k, decision: "verified" });
                          if (r.ok) apply(r.status);
                        }}><Check size={16} aria-hidden /> {v.demoApprove}</button>
                        <button type="button" className="btn btn-ghost !min-h-10" onClick={async () => {
                          const r = await postJson<{ status: StatusMap }>("/api/verification/review", { kind: k, decision: "rejected", note: "Photo was blurry (demo)" });
                          if (r.ok) apply(r.status);
                        }}>{v.demoReject}</button>
                      </div>
                    </div>
                  )}

                  {canAct && (
                    <div className="mt-4 pl-2">
                      {!expanded ? (
                        <button type="button" className="btn btn-ghost" aria-expanded={false} onClick={() => setOpen(k)}>{t.common.continue}</button>
                      ) : (
                        <div className="border-t border-line pt-4">
                          {k === "id" && <IdForm onDone={apply} errText={errText} docs={KYC_DOCS[role]} />}
                          {k === "selfie" && (status.id.status === "not_started" || status.id.status === "rejected"
                            ? <p className="text-sm font-semibold text-danger">{v.errors.id_first}</p>
                            : <SelfieForm onDone={apply} errText={errText} demoMode={demoMode} />)}
                          {k === "address" && (area
                            ? <AddressForm onDone={apply} errText={errText} city={city} area={area} />
                            : <p className="flex flex-wrap items-center gap-2 text-sm"><span className="text-danger">{v.needLocation}</span> <Link href="/location" className="btn btn-quiet"><MapPin size={15} aria-hidden /> {v.setLocation}</Link></p>)}
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
        <section aria-labelledby="priv-h" className="relative overflow-hidden rounded-[4px] bg-forest p-5 text-[#d9e8dd] lg:sticky lg:top-[calc(var(--header-h)+16px)]">
          <h2 id="priv-h" className="font-display flex items-center gap-2 text-xl font-bold text-white"><ShieldCheck size={20} aria-hidden className="text-leaf" /> {v.privacyTitle}</h2>
          <ul className="mt-3 space-y-2.5 text-[0.95rem]">
            {v.privacy.map((p) => <li key={p} className="flex gap-2"><Check size={16} aria-hidden className="mt-1 shrink-0 text-leaf" /> {p}</li>)}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function StatusChip({ status, label }: { status: VerificationStatus; label: string }) {
  const cls = {
    verified: "bg-accent text-accent-contrast",
    pending: "bg-[#fff1cc] text-[#6b4a00] dark:bg-[#3a2c08] dark:text-[#f6d27a]",
    rejected: "bg-danger-soft text-danger",
    not_started: "bg-surface-2 text-muted",
  }[status];
  const Icon = { verified: Check, pending: Clock, rejected: AlertTriangle, not_started: Circle }[status];
  return <span className={`inline-flex items-center gap-1 rounded-[3px] px-2 py-0.5 text-xs font-bold ${cls}`}><Icon size={12} aria-hidden /> {label}</span>;
}

function RemoveButton({ label, confirm, onRemoved }: { label: string; confirm: string; onRemoved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className="btn btn-quiet !min-h-9 text-sm !text-danger" disabled={busy}
      onClick={async () => { if (!window.confirm(confirm)) return; setBusy(true); await onRemoved(); setBusy(false); }}>
      <Trash2 size={15} aria-hidden /> {label}
    </button>
  );
}

type FormProps = { onDone: (s: StatusMap) => void; errText: (e?: string) => string };

function Consent({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
      <span>{label}</span>
    </label>
  );
}

function IdForm({ onDone, errText, docs }: FormProps & { docs: readonly DocType[] }) {
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
    fd.set("docType", docType); fd.set("consent", "yes");
    fd.set("front", front, "front.jpg");
    if (back) fd.set("back", back, "back.jpg");
    setBusy(true);
    const r = await postForm<{ status: StatusMap }>("/api/verification/id", fd);
    setBusy(false);
    if (r.ok) onDone(r.status); else setErr(errText(r.error));
  };

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
      <fieldset>
        <legend className="field-label">{v.docType}</legend>
        <div className="flex flex-wrap gap-2">
          {docs.map((d) => (
            <label key={d} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[4px] border-[1.5px] px-3 text-[0.95rem] font-semibold ${docType === d ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}>
              <input type="radio" name="docType" value={d} checked={docType === d} onChange={() => setDocType(d)} className="accent-[var(--accent)]" /> {v.docTypes[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <PhotoInput label={v.front} value={front} onChange={setFront} capture="environment" required chooseLabel={v.choose} changeLabel={v.change} />
        <PhotoInput label={backRequired ? v.back : v.backOptional} value={back} onChange={setBack} capture="environment" required={backRequired} chooseLabel={v.choose} changeLabel={v.change} />
      </div>
      <Consent name="consent" label={v.consentId} checked={consent} onChange={setConsent} />
      {err && <p role="alert" className="field-error">{err}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? v.sending : v.submit}</button>
    </form>
  );
}

function SelfieForm({ onDone, errText, demoMode }: FormProps & { demoMode: boolean }) {
  const { t } = useI18n();
  const v = t.verify;
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [camera, setCamera] = useState(false);
  const [denied, setDenied] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Decided after mount: the server can't know whether this device has a camera (avoids a hydration mismatch).
  const [hasCamera, setHasCamera] = useState(false);
  useEffect(() => setHasCamera(!!navigator.mediaDevices?.getUserMedia), []);
  const onDenied = useCallback(() => { setDenied(true); setCamera(false); }, []);

  const send = async () => {
    setErr(null);
    if (!selfie) return setErr(v.errors.file_missing);
    if (!consent) return setErr(v.errors.consent);
    const fd = new FormData();
    fd.set("consent", "yes"); fd.set("selfie", selfie, "selfie.jpg");
    setBusy(true);
    const r = await postForm<{ status: StatusMap }>("/api/verification/selfie", fd);
    setBusy(false);
    if (r.ok) onDone(r.status); else setErr(errText(r.error));
  };

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
      <p className="text-sm text-muted">{v.selfieTips}</p>
      {demoMode && <p className="flex items-center gap-2 text-sm"><span className="demo-tag">{v.simulated}</span> {v.selfieSim}</p>}
      {camera ? (
        <SelfieCamera labels={{ capture: v.capture, close: v.closeCamera }} onCapture={setSelfie} onClose={() => setCamera(false)} onDenied={onDenied} />
      ) : (
        <div className="flex flex-wrap items-end gap-4">
          {hasCamera && !denied && <button type="button" className="btn btn-ghost" onClick={() => setCamera(true)}><Camera size={18} aria-hidden /> {v.camera}</button>}
          <PhotoInput label={hasCamera && !denied ? v.upload : v.steps.selfie.title} value={selfie} onChange={setSelfie} capture="user" chooseLabel={v.choose} changeLabel={v.change} />
        </div>
      )}
      {denied && <p className="text-sm text-danger">{v.cameraDenied}</p>}
      <Consent name="consent" label={v.consentSelfie} checked={consent} onChange={setConsent} />
      {err && <p role="alert" className="field-error">{err}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? v.sending : v.submit}</button>
    </form>
  );
}

function AddressForm({ onDone, errText, city, area }: FormProps & { city: string; area: string }) {
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
    if (r.ok) onDone(r.status); else setErr(errText(r.error));
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
      <p className="flex items-center gap-2 text-sm"><MapPin size={15} aria-hidden className="text-accent" /> {v.addrFrom(city, area)} · <Link href="/location" className="font-semibold text-accent hover:underline">{v.setLocation}</Link></p>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
        <label className="block"><span className="field-label">{v.ward}</span>
          <input className="input" inputMode="numeric" maxLength={2} value={ward} onChange={(e) => setWard(e.target.value.replace(/\D/g, ""))} /></label>
        <label className="block"><span className="field-label">{v.tole}</span>
          <input className="input" maxLength={80} value={tole} onChange={(e) => setTole(e.target.value)} autoComplete="address-line1" /></label>
      </div>
      <label className="block"><span className="field-label">{v.landmark} <span className="font-normal text-muted">({t.common.optional})</span></span>
        <input className="input" maxLength={80} value={landmark} onChange={(e) => setLandmark(e.target.value)} /></label>
      {err && <p role="alert" className="field-error">{err}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? v.sending : v.submit}</button>
    </form>
  );
}

function WomenForm({ onDone, errText }: FormProps) {
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
    fd.set("groupName", groupName); fd.set("members", members); fd.set("declaration", "yes"); fd.set("proof", proof, "proof.jpg");
    setBusy(true);
    const r = await postForm<{ status: StatusMap }>("/api/verification/women-group", fd);
    setBusy(false);
    if (r.ok) onDone(r.status); else setErr(errText(r.error));
  };

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }} noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
        <label className="block"><span className="field-label">{v.groupName}</span>
          <input className="input" maxLength={80} value={groupName} onChange={(e) => setGroupName(e.target.value)} /></label>
        <label className="block"><span className="field-label">{v.members}</span>
          <input className="input" inputMode="numeric" maxLength={3} value={members} onChange={(e) => setMembers(e.target.value.replace(/\D/g, ""))} /></label>
      </div>
      <PhotoInput label={v.proof} value={proof} onChange={setProof} capture="environment" required chooseLabel={v.choose} changeLabel={v.change} />
      <Consent name="declaration" label={v.declaration} checked={decl} onChange={setDecl} />
      {err && <p role="alert" className="field-error">{err}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? v.sending : v.submit}</button>
    </form>
  );
}
