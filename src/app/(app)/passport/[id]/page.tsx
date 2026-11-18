import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, Star, Briefcase } from "lucide-react";
import { Contours } from "@/components/contours";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { passportFor } from "@/lib/wallet";
import { CATEGORIES } from "@/lib/pricing";
import { num, npDate, rs } from "@/lib/format";
import { toDeva } from "@/lib/i18n/dict";

export const metadata: Metadata = { title: "Earnings Passport" };
export const dynamic = "force-dynamic";

/**
 * Public Passport (signed-in viewers): jobs, rating, verification and skills.
 * Earnings stay private — only the owner sees the amount (on their Wallet).
 */
export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [viewer, { t, lang }] = await Promise.all([requireUser(`/passport/${id}`), getDict()]);
  const user = /^[0-9a-f-]{36}$/.test(id) ? await store.getUserById(id) : null;
  if (!user || !user.roles.includes("provider")) notFound();
  const p = await passportFor(user);
  const ratings = (await store.listRatingsFor(user.id)).slice(0, 5);
  const own = viewer.id === user.id;
  const pp = t.passport;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <article className="relative overflow-hidden rounded-[6px] bg-forest p-6 text-[#d9e8dd] sm:p-8 [--contour:rgba(108,195,106,.14)]">
        <Contours seed={user.name.length * 3} centers={1} rings={7} />
        <div className="relative">
          <div className="flex items-start justify-between gap-3"><Logo onDark /><span className="text-xs font-semibold uppercase tracking-wider text-leaf">{pp.title}</span></div>
          <h1 className="font-display mt-6 text-3xl font-extrabold text-white sm:text-4xl">{user.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            {p.verified ? <><BadgeCheck size={16} aria-hidden className="text-leaf" /> {pp.verified}</> : pp.notVerified} · {user.city}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div><dt className="text-xs uppercase tracking-wider text-leaf">{pp.jobs}</dt><dd className="font-display text-3xl font-extrabold text-white">{num(p.completedJobs, lang)}</dd></div>
            <div><dt className="text-xs uppercase tracking-wider text-leaf">{pp.rating}</dt>
              <dd className="font-display flex items-center gap-1 text-3xl font-extrabold text-white"><Star size={20} aria-hidden className="fill-marigold text-marigold" />{p.ratingCount ? (lang === "ne" ? toDeva(p.rating.toFixed(1)) : p.rating.toFixed(1)) : "—"}</dd>
              <dd className="text-xs">{pp.ratingCount(p.ratingCount)}</dd></div>
            {own && <div><dt className="text-xs uppercase tracking-wider text-leaf">{pp.earnings}</dt><dd className="font-display text-3xl font-extrabold text-white">{rs(p.verifiedEarnings, lang)}</dd></div>}
          </dl>
          {p.categories.length > 0 && (
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 text-sm"><Briefcase size={15} aria-hidden className="text-leaf" />
              {p.categories.map((c) => { const x = CATEGORIES.find((k) => k.id === c); return x ? (lang === "ne" ? x.ne : x.en) : c; }).join(" · ")}</p>
          )}
          <p className="mt-2 text-xs text-[#b7cdbd]">{pp.since(npDate(p.since, lang))}</p>
          {p.completedJobs === 0 && <p className="mt-4 text-sm">{pp.none}</p>}
        </div>
      </article>
      {ratings.length > 0 && (
        <section className="mt-6" aria-labelledby="pr-h">
          <h2 id="pr-h" className="font-display text-xl font-bold">{t.profile.reviews}</h2>
          <ul className="mt-3 space-y-3">
            {ratings.map((r) => (
              <li key={r.id} className="border-l-4 border-leaf bg-surface p-4">
                <span className="inline-flex gap-0.5" aria-label={`${r.stars} / 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} aria-hidden className={i < r.stars ? "fill-marigold text-marigold" : "text-line-strong"} />)}</span>
                {r.text && <p className="mt-1">{r.text}</p>}
                <p className="text-xs text-muted">{npDate(r.createdAt, lang)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
