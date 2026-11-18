"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Coins, Repeat2, Search } from "lucide-react";
import { postJson, useI18n, useUser } from "@/components/providers";
import { TerraceSteps } from "@/components/terrace-steps";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { CATEGORIES, type CategoryId } from "@/lib/pricing";
import { PROVINCES, type ProvinceId } from "@/lib/geo";
import { isNepalMobile } from "./phone-input";
import { IdentityInput, isEmailAddress, targetBody, type Channel } from "./identity-input";
import { OtpStep } from "./otp-step";
import { AuthSwitch } from "./auth-switch";
import { SetMpin } from "./set-mpin";
import type { PublicUser } from "@/lib/store/types";

type Role = "client" | "provider" | "both";
const MAX_CATS = 10;

/**
 * Sign-up: ① phone or email → ② verify the code → ③ select your region (province)
 * → ④ set up your account (name, city, goal, categories, consent) → ⑤ MPIN.
 */
export function SignupFlow({ cities }: { cities: readonly string[] }) {
  const { t, lang } = useI18n();
  const s = t.signup;
  const { setUser } = useUser();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<Channel>("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [province, setProvince] = useState<ProvinceId | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [city, setCity] = useState("");
  const goalParam = useSearchParams().get("goal");
  const [role, setRole] = useState<Role>(goalParam === "provider" || goalParam === "both" ? goalParam : "client");
  const [cats, setCats] = useState<CategoryId[]>([]);
  const [catQuery, setCatQuery] = useState("");
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errs, setErrs] = useState<{ name?: string; city?: string; cats?: string; terms?: string }>({});
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  const prov = PROVINCES.find((p) => p.id === province);
  const provName = prov ? (lang === "ne" ? prov.ne : prov.en) : "";
  const provinceCities = useMemo(() => (prov ? [...prov.cities, "Other"].filter((c) => cities.includes(c)) : []), [prov, cities]);
  const fullName = `${first.trim()} ${last.trim()}`.trim();
  const nameOk = (n: string) => /^[\p{L}\p{M}][\p{L}\p{M} .'’-]{1,59}$/u.test(n);
  const needsCats = role !== "client";

  const catList = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return CATEGORIES.filter((c) => c.id !== "other")
      .filter((c) => !q || c.en.toLowerCase().includes(q) || c.ne.includes(q))
      .sort((a, b) => (lang === "ne" ? a.ne : a.en).localeCompare(lang === "ne" ? b.ne : b.en));
  }, [catQuery, lang]);

  const toggleCat = (id: CategoryId) => {
    setErrs((e) => ({ ...e, cats: undefined }));
    setCats((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_CATS ? c : [...c, id]));
  };

  const register = async (mpin: string) => {
    setBusy(true); setServerErr(null);
    const r = await postJson<{ user: PublicUser }>("/api/auth/register", {
      name: fullName, city, role, mpin, lang, categories: cats, marketingOptIn: marketing, acceptTerms: terms,
    });
    setBusy(false);
    if (r.ok) {
      try { localStorage.setItem(channel === "email" ? "sk_last_email" : "sk_last_phone", channel === "email" ? email.trim().toLowerCase() : phone); localStorage.setItem("sk_last_channel", channel); } catch { /* ignore */ }
      setUser(r.user);
      router.replace(role === "client" ? "/" : "/verification");
      router.refresh();
      return;
    }
    if (r.error === "mpin_weak") setServerErr(s.weak);
    else if (r.error === "phone_taken") setServerErr(s.taken);
    else if (r.error === "email_taken") setServerErr(s.emailTaken);
    else if (r.error === "categories_required") { setErrs({ cats: s.catsRequired }); setStep(3); }
    else if (r.error === "terms_required") { setErrs({ terms: s.termsRequired }); setStep(3); }
    else if (r.error === "otp_required") { setServerErr(t.errors.otp_required); setStep(0); }
    else setServerErr(r.error === "offline" ? t.errors.offline : t.errors.generic);
  };

  const goals = [
    { v: "client" as const, title: s.goalClient, sub: s.goalClientSub, Icon: CheckCircle2 },
    { v: "provider" as const, title: s.goalProvider, sub: s.goalProviderSub, Icon: Coins },
    { v: "both" as const, title: s.goalBoth, sub: s.goalBothSub, Icon: Repeat2 },
  ];

  return (
    <div>
      {step === 0 && <AuthSwitch active="signup" />}
      <h1 className="font-display text-[2rem] font-extrabold sm:text-[2.3rem]">
        {step === 2 ? s.regionTitle : step === 3 ? s.setupTitle : s.title}
      </h1>
      <div className="mt-5"><TerraceSteps steps={s.steps} current={step} label={s.title} /></div>

      {step > 0 && step < 4 && (
        <button type="button" className="btn btn-quiet -ml-2 mb-3" onClick={() => setStep((x) => x - 1)}>
          <ArrowLeft size={16} aria-hidden /> {t.common.back}
        </button>
      )}

      {/* ① phone or email */}
      {step === 0 && (
        <form className="space-y-6" noValidate onSubmit={(e) => {
          e.preventDefault();
          if (channel === "phone" && !isNepalMobile(phone)) return setPhoneErr(t.errors.phone_invalid);
          if (channel === "email" && !isEmailAddress(email)) return setPhoneErr(t.errors.email_invalid);
          setStep(1);
        }}>
          <fieldset>
            <legend className="font-display mb-3 text-xl font-bold">{s.goal}</legend>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {goals.map(({ v, title, sub, Icon }) => (
                <label key={v} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-[10px] border-[1.5px] p-4 text-center transition-colors ${role === v ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}>
                  <input type="radio" name="goal" value={v} checked={role === v} onChange={() => setRole(v)} className="sr-only" />
                  <Icon size={26} aria-hidden className="text-accent" />
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-muted">{sub}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-muted">{s.phoneLead}</p>
          <IdentityInput channel={channel} onChannel={(c) => { setChannel(c); setPhoneErr(null); setServerErr(null); }}
            phone={phone} onPhone={(v) => { setPhone(v); setPhoneErr(null); }}
            email={email} onEmail={(v) => { setEmail(v); setPhoneErr(null); }}
            error={phoneErr ?? serverErr} autoFocus />
          <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-44">{t.common.continue}</button>
        </form>
      )}

      {/* ② verify */}
      {step === 1 && (
        <OtpStep target={targetBody(channel, phone, email) as { phone: string } | { email: string }} purpose="signup"
          onVerified={() => setStep(2)} onChangeNumber={() => setStep(0)} />
      )}

      {/* ③ select your region */}
      {step === 2 && (
        <div>
          <p className="text-muted">{s.regionLead}</p>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[10px] border border-line bg-surface">
            {PROVINCES.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => { setProvince(p.id); setCity(p.cities[0]); setStep(3); }}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent-soft ${province === p.id ? "bg-accent-soft" : ""}`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-sm font-bold text-accent" aria-hidden>
                    {(lang === "ne" ? p.ne : p.en).slice(0, 1)}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">{lang === "ne" ? p.ne : p.en}</span>
                    <span className="block truncate text-sm text-muted">{p.cities.slice(0, 4).join(", ")}{p.cities.length > 4 ? " …" : ""}</span>
                  </span>
                  {province === p.id ? <Check size={18} aria-hidden className="text-accent" /> : <ChevronRight size={18} aria-hidden className="text-muted" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ④ set up your account */}
      {step === 3 && prov && (
        <form className="space-y-6" noValidate onSubmit={(e) => {
          e.preventDefault();
          const ne: typeof errs = {};
          if (!nameOk(fullName)) ne.name = first.trim().length < 2 ? t.errors.name_short : t.errors.name_chars;
          if (!city) ne.city = t.errors.city;
          if (needsCats && cats.length === 0) ne.cats = s.catsRequired;
          if (!terms) ne.terms = s.termsRequired;
          setErrs(ne);
          if (!ne.name && !ne.city && !ne.cats && !ne.terms) setStep(4);
        }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="su-first" className="field-label">{s.firstName} *</label>
              <input id="su-first" className="input" autoComplete="given-name" value={first} maxLength={40} autoFocus
                aria-invalid={errs.name ? true : undefined} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div>
              <label htmlFor="su-last" className="field-label">{s.lastName}</label>
              <input id="su-last" className="input" autoComplete="family-name" value={last} maxLength={40}
                aria-describedby="su-last-h" onChange={(e) => setLast(e.target.value)} />
            </div>
          </div>
          {errs.name ? <p role="alert" className="field-error -mt-3">{errs.name}</p> : <p id="su-last-h" className="field-hint -mt-3">{s.lastHint}</p>}

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="su-city" className="field-label">{s.homeCity} *</label>
              <button type="button" className="btn btn-quiet !min-h-0 py-1 text-sm" onClick={() => setStep(2)}>{s.changeRegion}</button>
            </div>
            <select id="su-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} aria-describedby="su-city-h">
              {provinceCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {errs.city ? <p role="alert" className="field-error">{errs.city}</p> : <p id="su-city-h" className="field-hint">{s.cityIn(provName)}</p>}
          </div>

          <div>
            <p className="field-label">{s.goal}</p>
            <div role="radiogroup" aria-label={s.goal} className="flex gap-1 rounded-[8px] bg-surface-2 p-1">
              {goals.map(({ v, title }) => (
                <button key={v} type="button" role="radio" aria-checked={role === v} onClick={() => setRole(v)}
                  className={`flex-1 rounded-[6px] px-2 py-2 text-sm font-semibold transition-colors ${role === v ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-text"}`}>{title}</button>
              ))}
            </div>
          </div>

          <fieldset>
            <legend className="field-label">{needsCats ? `${s.catsProvider} *` : s.catsClient}</legend>
            <p className="field-hint -mt-1 mb-2">{needsCats ? s.catsProviderHint : s.catsClientHint} <strong className="text-text">{s.catsSelected(cats.length)}</strong></p>
            <label className="relative block">
              <span className="sr-only">{s.catsSearch}</span>
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input type="search" className="input !min-h-10 !pl-9" placeholder={s.catsSearch} value={catQuery} onChange={(e) => setCatQuery(e.target.value)} />
            </label>
            <ul className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-y-auto p-0.5">
              {catList.map((c) => {
                const on = cats.includes(c.id);
                const Icon = CATEGORY_ICONS[c.id];
                const full = !on && cats.length >= MAX_CATS;
                return (
                  <li key={c.id}>
                    <button type="button" aria-pressed={on} disabled={full} onClick={() => toggleCat(c.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${on ? "border-accent bg-accent text-accent-contrast" : "border-line-strong hover:border-accent"}`}>
                      {on ? <Check size={15} aria-hidden /> : <Icon size={15} aria-hidden />} {lang === "ne" ? c.ne : c.en}
                    </button>
                  </li>
                );
              })}
            </ul>
            {errs.cats && <p role="alert" className="field-error">{errs.cats}</p>}
            {cats.length >= MAX_CATS && <p className="field-hint">{s.catsMax}</p>}
          </fieldset>

          <div className="space-y-3 border-t border-line pt-5">
            <label className="flex cursor-pointer items-start gap-3 text-[0.95rem]">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
              <span>{s.marketing}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 text-[0.95rem]">
              <input type="checkbox" checked={terms} onChange={(e) => { setTerms(e.target.checked); setErrs((x) => ({ ...x, terms: undefined })); }}
                aria-invalid={errs.terms ? true : undefined} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
              <span>
                {s.termsAgree}{" "}
                <Link href="/terms" target="_blank" className="font-semibold text-accent underline-offset-4 hover:underline">{s.termsLink}</Link>{" "}
                {s.and}{" "}
                <Link href="/privacy" target="_blank" className="font-semibold text-accent underline-offset-4 hover:underline">{s.privacyLink}</Link> *
              </span>
            </label>
            {errs.terms && <p role="alert" className="field-error">{errs.terms}</p>}
          </div>

          <button type="submit" className="btn btn-primary w-full sm:w-auto sm:min-w-44">{t.common.continue}</button>
        </form>
      )}

      {/* ⑤ MPIN */}
      {step === 4 && (
        <>
          <SetMpin submitLabel={s.done} onSubmit={(p) => void register(p)} serverError={serverErr} busy={busy} />
          <p className="mt-4 text-xs text-muted">{s.terms}</p>
        </>
      )}

      <p className="mt-6 border-t border-line pt-5 text-[0.95rem] text-muted">
        {s.have}{" "}
        <Link href="/login" className="font-semibold text-accent underline-offset-4 hover:underline">{t.login.submit}</Link>
      </p>
    </div>
  );
}
