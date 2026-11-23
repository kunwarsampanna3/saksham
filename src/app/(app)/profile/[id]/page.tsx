import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AbroadWorkRecord } from "@/components/abroad/work-record";
import { MemberProfile } from "@/components/abroad/member-profile";
import { abroadRecord } from "@/lib/abroad";
import { store } from "@/lib/store";
import { PERSONA_PROFILE } from "@/lib/tasks";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Check,
  Circle,
  Globe2,
  Languages,
  MapPin,
  MessageCircle,
  Star,
  BriefcaseBusiness,
  CalendarDays,
} from "lucide-react";
import { Photo } from "@/components/photo";
import { Contours } from "@/components/contours";
import { NepalMap } from "@/components/map/map";
import { VerifiedStamp, WomenLedBadge, Stars, CATEGORY_ICONS } from "@/components/browse/cards";
import { ProfileActions } from "@/components/browse/quote-button";
import { currentUser, requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { isVerified, providerCoords } from "@/lib/seed/providers";
import { findProvider } from "@/lib/real-providers";
import { category } from "@/lib/pricing";
import { rs, rsRange, num } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";
import { config } from "@/lib/config";
import { MyProfile } from "@/components/profile/my-profile";
import { passportFor } from "@/lib/wallet";
import { statusFor } from "@/lib/verification";
import { openTasksFor } from "@/lib/task-search";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  if (id === "me") return { title: "My profile" };
  const [p, viewer] = await Promise.all([findProvider(id), currentUser()]);
  return { title: p && (p.isReal || viewer?.isDemo) ? p.name : "Profile" };
}

export default async function Profile({ params }: { params: Params }) {
  const { id } = await params;
  const [viewer, { t, lang }] = await Promise.all([requireUser(`/profile/${id}`), getDict()]);
  // Your own profile, with your skills to see and change.
  if (id === "me") {
    const [passport, checks, open, { records }] = await Promise.all([
      passportFor(viewer),
      statusFor(viewer),
      openTasksFor(viewer),
      abroadRecord(viewer.id, viewer),
    ]);
    const openJobs: Record<string, number> = {};
    for (const task of open) openJobs[task.category] = (openJobs[task.category] ?? 0) + 1;
    const persona = PERSONA_PROFILE[viewer.phone];
    const publicHref = viewer.roles.includes("provider")
      ? viewer.isDemo
        ? persona
          ? `/profile/${persona}`
          : null
        : `/profile/${viewer.id}`
      : null;
    return (
      <MyProfile
        user={viewer}
        passport={passport}
        checks={checks}
        openJobs={openJobs}
        records={records}
        publicHref={publicHref}
        t={t}
        lang={lang}
      />
    );
  }
  const p = await findProvider(id);

  // No service profile (recruiters, workers abroad, yourself): a simple profile with the work abroad record.
  if (!p) {
    const person = /^[0-9a-f-]{36}$/.test(id) ? await store.getUserById(id) : null;
    if (!person || person.isDemo !== viewer.isDemo) notFound();
    if (person.id === viewer.id) redirect("/profile/me");
    const self = false;
    const { known, records } = await abroadRecord(person.id, viewer);
    if (!self && !known) notFound();
    return <MemberProfile person={person} records={records} self={self} t={t} lang={lang} />;
  }
  // Example profiles are for the demo accounts only.
  if (!p.isReal && !viewer.isDemo) notFound();

  // An example profile can belong to a demo account.
  const personaPhone = Object.entries(PERSONA_PROFILE).find(([, slug]) => slug === p.id)?.[0];
  const ownerId = p.isReal ? p.id : personaPhone ? (await store.getUserByPhone(personaPhone))?.id : undefined;
  const workAbroad = ownerId ? (await abroadRecord(ownerId, viewer)).records : [];

  const b = t.browse,
    pr = t.profile;
  const verified = isVerified(p);
  const coords = providerCoords(p);
  const locale = lang === "ne" ? "ne-NP" : "en-GB";
  const tz = "Asia/Kathmandu";

  // Skill Passport QR → this profile's passport section (public record)
  const passportUrl = `${config.appOrigin}/profile/${p.id}#passport`;
  const qr = await QRCode.toString(passportUrl, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0E3B2C", light: "#FFFFFF" },
  });

  const since = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: tz }).format(
    new Date(`${p.memberSince}-15T00:00:00Z`),
  );
  const initials = p.name
    .replace(/[^\p{L} ]/gu, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const ratingTxt = p.ratingCount ? (lang === "ne" ? toDeva(p.rating.toFixed(1)) : p.rating.toFixed(1)) : "—";

  // Next 14 days from the weekly pattern (Nepal time)
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() + i * 86_400_000);
    const jsDay = new Date(d.toLocaleString("en-US", { timeZone: tz })).getDay(); // 0 = Sun
    const free = p.week[(jsDay + 6) % 7];
    return {
      key: i,
      free,
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: tz }).format(d),
      date: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: tz }).format(d),
      full: new Intl.DateTimeFormat(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: tz,
      }).format(d),
    };
  });

  const checks = (["phone", "id", "selfie", "address", "womenGroup"] as const).filter(
    (k) => k !== "womenGroup" || p.womenLed,
  );

  return (
    <div>
      {/* ------------------------------------------------------------ header */}
      <div className="relative h-44 overflow-hidden sm:h-56">
        {p.isReal ? (
          <div className="from-forest via-forest to-accent h-full w-full bg-gradient-to-br" aria-hidden />
        ) : (
          <Photo k={p.cover} priority sizes="100vw" />
        )}
        <div className="from-forest/80 absolute inset-0 bg-gradient-to-t to-transparent" aria-hidden />
      </div>
      <div className="relative mx-auto max-w-[88rem] px-4 sm:px-6">
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-4">
            <span
              aria-hidden
              className="font-display border-bg bg-forest -mt-16 inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-[6px] border-4 text-3xl font-bold text-white sm:h-28 sm:w-28"
            >
              {initials}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {!p.isReal && <span className="demo-tag">{b.exampleProfile}</span>}
                {verified && <VerifiedStamp label={b.verified} />}
                {p.womenLed && <WomenLedBadge label={b.womenLed} />}
                <span className="bg-accent-soft text-accent rounded-[3px] px-2 py-0.5 text-xs font-bold">
                  {b.level(p.level)}
                </span>
              </div>
              <h1 className="font-display mt-1.5 text-3xl font-extrabold sm:text-4xl">{p.name}</h1>
              <p className="text-muted text-lg">{p.headline[lang]}</p>
            </div>
          </div>
          <ProfileActions providerId={p.id} providerName={p.name} />
        </div>

        <dl className="border-line bg-line mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border sm:grid-cols-4">
          {[
            {
              label: pr.rating,
              value: (
                <span className="inline-flex items-center gap-1">
                  <Star size={18} aria-hidden className="fill-marigold text-marigold" />
                  {ratingTxt}
                </span>
              ),
              sub: p.ratingCount ? b.reviews(p.ratingCount) : b.noReviews,
            },
            { label: pr.completed, value: num(p.jobsDone, lang), sub: b.level(p.level) },
            {
              label: pr.response,
              value: p.isReal && !p.responseMinutes ? b.newProvider : b.respTime(p.responseMinutes),
              sub: "",
            },
            { label: pr.priceRange, value: rsRange(p.priceMin, p.priceMax, lang), sub: "" },
          ].map((s) => (
            <div key={s.label} className="bg-surface p-4">
              <dt className="text-muted text-xs font-semibold tracking-wider uppercase">{s.label}</dt>
              <dd className="font-display mt-1 text-xl font-extrabold">{s.value}</dd>
              {s.sub && <dd className="text-muted text-sm">{s.sub}</dd>}
            </div>
          ))}
        </dl>
      </div>

      {/* ------------------------------------------------------------ body */}
      <div className="mx-auto mt-4 max-w-[88rem] px-4 sm:px-6">
        <Link href="/professionals" className="btn btn-quiet -ml-2">
          <ArrowLeft size={16} aria-hidden /> {pr.back}
        </Link>
      </div>
      <div className="mx-auto mt-6 grid max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-12">
        <div className="space-y-12 lg:col-span-8">
          <section aria-labelledby="about-h">
            <h2 id="about-h" className="font-display text-2xl font-bold">
              {pr.about}
            </h2>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed">{p.bio[lang]}</p>
            <ul className="text-muted mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
              <li className="inline-flex items-center gap-1.5">
                <MapPin size={16} aria-hidden /> {pr.area}: {p.area}, {p.city} · {pr.radius(p.radiusKm)}
              </li>
              {p.onlineOk && (
                <li className="inline-flex items-center gap-1.5">
                  <Globe2 size={16} aria-hidden /> {b.onlineOk}
                </li>
              )}
              <li className="inline-flex items-center gap-1.5">
                <Languages size={16} aria-hidden /> {pr.languages}: {p.languages.join(", ")}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays size={16} aria-hidden /> {pr.memberSince(since)}
              </li>
            </ul>
            <ul className="mt-4 flex flex-wrap gap-2">
              {p.categories.map((c) => {
                const Icon = CATEGORY_ICONS[c];
                return (
                  <li
                    key={c}
                    className="border-line inline-flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-sm font-semibold"
                  >
                    <Icon size={15} aria-hidden className="text-accent" />
                    {lang === "ne" ? category(c).ne : category(c).en}
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-labelledby="svc-h">
            <h2 id="svc-h" className="font-display text-2xl font-bold">
              {pr.services}
            </h2>
            <ul className="divide-line border-line mt-4 divide-y border-y">
              {p.services.map((s) => (
                <li key={s.en} className="flex flex-wrap items-baseline justify-between gap-2 py-3.5">
                  <span className="font-semibold">{s[lang]}</span>
                  <span>
                    <strong className="font-display text-lg">{rs(s.price, lang)}</strong>{" "}
                    <span className="text-muted text-sm">{s.unit[lang]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {p.portfolio.length > 0 && (
            <section aria-labelledby="port-h">
              <h2 id="port-h" className="font-display text-2xl font-bold">
                {pr.portfolio}
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {p.portfolio.map((k) => (
                  <li key={k} className="relative aspect-[4/3] overflow-hidden rounded-[4px]">
                    <Photo k={k} sizes="(min-width:640px) 30vw, 50vw" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {workAbroad.length > 0 && (
            <AbroadWorkRecord records={workAbroad} self={ownerId === viewer.id} t={t} lang={lang} />
          )}

          <section aria-labelledby="rev-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="rev-h" className="font-display text-2xl font-bold">
                {pr.reviews}
              </h2>
              <Stars rating={p.rating} count={p.ratingCount} t={t} lang={lang} />
            </div>
            {p.reviews.length ? (
              <ul className="mt-4 space-y-3">
                {p.reviews.map((r) => (
                  <li key={r.by} className="border-leaf bg-surface border-l-4 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-0.5" aria-label={`${r.stars} / 5`}>
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star
                            key={i}
                            size={15}
                            aria-hidden
                            className={i < r.stars ? "fill-marigold text-marigold" : "text-line-strong"}
                          />
                        ))}
                      </span>
                      {!p.isReal && <span className="demo-tag">{pr.exampleReview}</span>}
                    </div>
                    <p className="mt-2">{r.text[lang]}</p>
                    <p className="text-muted mt-1 text-sm">— {r.by}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3">{b.noReviews}</p>
            )}
            {!p.isReal && <p className="text-muted mt-3 text-xs">{b.exampleNote}</p>}
          </section>
        </div>

        {/* ------------------------------------------------------------ sidebar */}
        <aside className="space-y-6 lg:col-span-4">
          <section aria-labelledby="ver-h" className="notch-frame">
            <div className="notch-card terrace-edge p-5">
              <h2 id="ver-h" className="font-display text-xl font-bold">
                {pr.verification}
              </h2>
              <ul className="mt-3 space-y-2">
                {checks.map((k) => {
                  const ok = !!p.verification[k];
                  return (
                    <li key={k} className="flex items-center justify-between gap-2 text-[0.95rem]">
                      <span className="inline-flex items-center gap-2">
                        {ok ? (
                          <Check size={17} aria-hidden className="text-accent" />
                        ) : (
                          <Circle size={15} aria-hidden className="text-line-strong" />
                        )}
                        {pr.checks[k]}
                      </span>
                      <span className={`text-xs font-bold uppercase ${ok ? "text-accent" : "text-muted"}`}>
                        {ok ? pr.done : pr.notYet}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>

          <section
            id="passport"
            aria-labelledby="pass-h"
            className="bg-forest relative overflow-hidden rounded-[4px] p-5 text-white [--contour:rgba(108,195,106,.14)]"
          >
            <Contours seed={p.id.length * 7} centers={1} rings={6} />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <h2 id="pass-h" className="font-display text-xl font-bold">
                  {pr.passport}
                </h2>
                {!p.isReal && (
                  <span className="demo-tag !border-white/40 !bg-white/10 !text-white">{b.example}</span>
                )}
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div
                  className="h-28 w-28 shrink-0 rounded-[4px] bg-white p-1.5"
                  role="img"
                  aria-label={`QR code: ${passportUrl}`}
                  dangerouslySetInnerHTML={{ __html: qr }}
                />
                <dl className="space-y-1.5 text-sm">
                  <div>
                    <dt className="text-leaf inline">{pr.completed}: </dt>
                    <dd className="inline font-bold">{num(p.jobsDone, lang)}</dd>
                  </div>
                  <div>
                    <dt className="text-leaf inline">{pr.rating}: </dt>
                    <dd className="inline font-bold">{ratingTxt}</dd>
                  </div>
                  <div>
                    <dt className="text-leaf inline">{pr.verification}: </dt>
                    <dd className="inline font-bold">{verified ? b.verified : pr.notYet}</dd>
                  </div>
                  <div className="inline-flex items-center gap-1 text-white/80">
                    <BriefcaseBusiness size={14} aria-hidden /> {pr.memberSince(since)}
                  </div>
                </dl>
              </div>
              <p className="mt-3 text-sm text-white/80">{pr.passportLead}</p>
            </div>
          </section>

          <section aria-labelledby="avail-h" className="notch-frame">
            <div className="notch-card p-5">
              <h2 id="avail-h" className="font-display text-xl font-bold">
                {pr.availability}
              </h2>
              <p className="text-muted text-sm">{pr.next14}</p>
              <ol className="mt-3 grid grid-cols-7 gap-1.5">
                {days.map((d) => (
                  <li
                    key={d.key}
                    title={`${d.full}: ${d.free ? pr.free : pr.busy}`}
                    className={`flex flex-col items-center rounded-[3px] py-1.5 text-center ${d.free ? "bg-accent text-accent-contrast" : "border-line-strong text-muted border border-dashed line-through decoration-1"}`}
                  >
                    <span className="text-[0.65rem] font-semibold uppercase">{d.weekday}</span>
                    <span className="font-display text-base font-bold">{d.date}</span>
                    <span className="sr-only">
                      {d.full}: {d.free ? pr.free : pr.busy}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-muted mt-3 flex gap-4 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="bg-accent h-3 w-3 rounded-[2px]" aria-hidden /> {pr.free}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="border-line-strong h-3 w-3 rounded-[2px] border border-dashed"
                    aria-hidden
                  />{" "}
                  {pr.busy}
                </span>
              </p>
            </div>
          </section>

          <section aria-label={pr.area} className="border-line h-56 overflow-hidden rounded-[4px] border">
            <NepalMap
              pins={[
                {
                  id: p.id,
                  lat: coords[0],
                  lng: coords[1],
                  kind: "provider",
                  label: p.name,
                  sub: `${p.area}, ${p.city}`,
                },
              ]}
              center={coords}
              zoom={12}
              label={`${pr.area}: ${p.area}, ${p.city}`}
            />
          </section>
          <p className="text-muted -mt-4 inline-flex items-center gap-1.5 text-xs">
            <MessageCircle size={13} aria-hidden /> {t.explore.mapNote}
          </p>
        </aside>
      </div>
    </div>
  );
}
