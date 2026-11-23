import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, ShieldCheck, Sparkles, Star } from "lucide-react";
import { Contours } from "@/components/contours";
import { VerifiedStamp } from "@/components/browse/cards";
import { AbroadWorkRecord } from "@/components/abroad/work-record";
import { SkillsEditor } from "@/components/profile/skills-editor";
import type { WorkRecord } from "@/lib/abroad";
import type { Passport } from "@/lib/wallet";
import type { StatusMap } from "@/lib/verification";
import type { User } from "@/lib/store/types";
import { CATEGORY_IDS, type CategoryId } from "@/lib/pricing";
import { initials, npDate, num, rs } from "@/lib/format";
import { toDeva, type Dict, type Lang } from "@/lib/i18n/dict";

/** Your own profile: who you are, your skills (editable), your record and your verification. */
export function MyProfile({
  user,
  passport,
  checks,
  openJobs,
  records,
  publicHref,
  t,
  lang,
}: {
  user: User;
  passport: Passport;
  checks: StatusMap;
  openJobs: Record<string, number>;
  records: WorkRecord[];
  publicHref: string | null;
  t: Dict;
  lang: Lang;
}) {
  const m = t.me;
  const skills = (user.categories ?? []).filter((c): c is CategoryId => (CATEGORY_IDS as string[]).includes(c));
  const rating = passport.rating.toFixed(1);
  const kinds: ("phone" | "id" | "selfie" | "address" | "womenGroup")[] = ["phone", "id", "selfie", "address"];
  if (user.womenLed) kinds.push("womenGroup");

  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={33} centers={1} rings={8} />
        <div className="relative mx-auto flex max-w-[88rem] flex-wrap items-center gap-5 px-4 py-10 sm:px-6">
          <span
            aria-hidden
            className="bg-forest font-display inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-[6px] text-3xl font-bold text-white"
          >
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-accent text-sm font-semibold">{m.title}</p>
            <h1 className="font-display text-4xl font-extrabold break-words">{user.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {user.roles.map((r) => (
                <span key={r} className="bg-accent-soft text-accent rounded-[3px] px-2 py-0.5 text-xs font-bold">
                  {m.roles[r]}
                </span>
              ))}
              {user.verified && <VerifiedStamp label={t.browse.verified} />}
              {user.isDemo && <span className="demo-tag">{t.common.exampleAccount}</span>}
            </div>
            <p className="text-muted mt-1 inline-flex flex-wrap items-center gap-x-1">
              <MapPin size={15} aria-hidden /> {user.area ? `${user.area}, ` : ""}
              {user.city} · {m.since(npDate(user.createdAt, lang))}
            </p>
            {user.headline && <p className="mt-1">{user.headline}</p>}
          </div>
          {publicHref && (
            <Link href={publicHref} className="btn btn-ghost">
              {m.publicView} <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto grid max-w-[88rem] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <SkillsEditor skills={skills} openJobs={openJobs} needsOne={user.roles.includes("provider")} />
          {user.roles.includes("provider") && (
            <Link
              href="/match?for=coach"
              className="border-line bg-surface hover:border-accent flex items-center gap-4 rounded-[14px] border p-5"
            >
              <span className="bg-accent text-accent-contrast grid h-11 w-11 shrink-0 place-items-center rounded-full">
                <Sparkles size={20} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-lg font-bold">{m.learn}</span>
                <span className="text-muted block text-sm">{m.learnLead}</span>
              </span>
              <ArrowRight size={18} aria-hidden className="text-accent shrink-0" />
            </Link>
          )}
          <AbroadWorkRecord records={records} self t={t} lang={lang} />
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="rec-h" className="border-line bg-surface rounded-[14px] border p-5">
            <h2 id="rec-h" className="font-display text-xl font-bold">
              {m.record}
            </h2>
            <dl className="mt-3 space-y-3">
              <div>
                <dt className="text-muted text-sm">{m.jobs}</dt>
                <dd className="font-display text-2xl font-extrabold">{num(passport.completedJobs, lang)}</dd>
              </div>
              <div>
                <dt className="text-muted text-sm">{m.earnings}</dt>
                <dd className="font-display text-2xl font-extrabold">{rs(passport.verifiedEarnings, lang)}</dd>
              </div>
              <div>
                <dt className="text-muted text-sm">{m.rating}</dt>
                <dd className="font-display inline-flex items-center gap-1 text-2xl font-extrabold">
                  {passport.ratingCount ? (
                    <>
                      <Star size={18} aria-hidden className="fill-marigold text-marigold" />
                      {lang === "ne" ? toDeva(rating) : rating}
                    </>
                  ) : (
                    <span className="text-muted text-base font-semibold">{m.noRating}</span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="ver-h" className="border-line bg-surface rounded-[14px] border p-5">
            <h2 id="ver-h" className="font-display flex items-center gap-2 text-xl font-bold">
              <ShieldCheck size={19} aria-hidden className="text-accent" /> {m.verification}
            </h2>
            <ul className="divide-line mt-2 divide-y text-sm">
              {kinds.map((k) => {
                const s = checks[k].status;
                return (
                  <li key={k} className="flex items-center justify-between gap-2 py-2">
                    <span>{t.profile.checks[k]}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${s === "verified" ? "text-accent" : s === "rejected" ? "text-danger" : "text-muted"}`}
                    >
                      {s === "verified" && <BadgeCheck size={15} aria-hidden />}
                      {m.states[s]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <Link href="/verification" className="btn btn-ghost mt-3 !min-h-10 w-full">
              {m.verify}
            </Link>
          </section>

          <section aria-labelledby="acc-h" className="border-line bg-surface rounded-[14px] border p-5">
            <h2 id="acc-h" className="font-display text-xl font-bold">
              {m.account}
            </h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              {[
                [m.phone, user.phone || "—"],
                [m.email, user.email || "—"],
                [m.city, user.city],
                [m.area, user.area || "—"],
                [m.language, user.lang === "ne" ? t.lang.ne : t.lang.en],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="min-w-0 text-right font-semibold break-words">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
