import Link from "next/link";
import {
  ArrowRight, BadgeCheck, ClipboardList, FileBadge2, LifeBuoy, MapPin, MessageSquare, Plus, Search, ShieldAlert, ShieldCheck, Wallet,
} from "lucide-react";
import { Group, QuickGrid } from "@/components/home/quick-grid";
import { ModeSwitch } from "@/components/home/mode-switch";
import { TaskRow } from "@/components/browse/cards";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { CATEGORY_IDS, type CategoryId } from "@/lib/pricing";
import { parseFilters } from "@/lib/search";
import { jobFeed, searchTasks } from "@/lib/task-search";
import { JobFeed } from "@/components/home/job-feed";
import { IT_CATEGORIES, isItWorker } from "@/lib/it";
import { statusFor } from "@/lib/verification";
import { profileItems } from "@/components/verify/profile-progress";
import { ANYWHERE } from "@/lib/geo";
import type { Dict, Lang } from "@/lib/i18n/dict";
import type { User } from "@/lib/store/types";

/**
 * Signed-in home, eSewa style: everything separated into clear cards — and different for the two kinds of user.
 *  - Hiring (client): post a task, categories to hire in, tasks nearby.
 *  - Working (provider): find work, offers, earnings, Passport, tasks that match your skills.
 */
export async function Dashboard({ t, lang, user, city }: { t: Dict; lang: Lang; user: User; city: string }) {
  const q = t.home.quick;
  const l = t.home.live;
  const working = user.activeRole === "provider";
  const both = user.roles.includes("client") && user.roles.includes("provider");
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const near = city === "Online" ? l.online : city === ANYWHERE ? l.everywhere : l.near(city);

  const skills = (user.categories ?? []).filter((c): c is CategoryId => (CATEGORY_IDS as string[]).includes(c));
  const all = await searchTasks(parseFilters({}, city, "tasks"), user);
  const tasks = (working && skills.length ? all.filter((x) => skills.includes(x.category as CategoryId)) : all).slice(0, 4);
  const itHome = working && isItWorker(user.categories);
  const jobs = itHome ? await jobFeed(user, IT_CATEGORIES) : [];
  const items = itHome ? profileItems(user, await statusFor(user)) : [];
  const pct = items.length ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;
  const it = t.home.jobs;

  return (
    <div className="mx-auto max-w-[72rem] space-y-4 px-3 py-5 sm:px-6 sm:py-8">
      {/* greeting */}
      <section aria-label={t.home.hello(user.name)} className="space-y-4 rounded-[14px] bg-forest p-5 text-white sm:p-6">
        {both && <ModeSwitch active={working ? "provider" : "client"} />}
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-leaf font-display text-xl font-extrabold text-forest" aria-hidden>{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-extrabold leading-tight">{t.home.hello(user.name)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
              <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {user.city}</span>
              <span>{working ? t.nav.providerMode : t.nav.clientMode}</span>
              {user.verified
                ? <span className="inline-flex items-center gap-1 font-semibold text-leaf"><BadgeCheck size={15} aria-hidden /> {q.verifiedYes}</span>
                : <Link href="/verification" className="inline-flex items-center gap-1 font-semibold text-leaf underline-offset-4 hover:underline"><ShieldCheck size={15} aria-hidden /> {q.verifyNow}</Link>}
            </p>
          </div>
          {working ? (
            <Link href="/explore" className="btn !min-h-12 w-full rounded-full bg-leaf px-6 font-bold text-forest hover:brightness-105 sm:w-auto">
              <Search size={18} aria-hidden /> {q.findWork}
            </Link>
          ) : (
            <Link href="/post" className="btn !min-h-12 w-full rounded-full bg-leaf px-6 font-bold text-forest hover:brightness-105 sm:w-auto">
              <Plus size={18} aria-hidden /> {q.post}
            </Link>
          )}
        </div>
      </section>

      {itHome ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
          <JobFeed jobs={jobs} />
          <aside className="space-y-4">
            <section className="rounded-[14px] border border-line bg-surface p-4">
              <h2 className="font-display font-bold">{it.profile}: <span className="text-accent">{t.verify.profilePct(pct)}</span></h2>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
              {pct < 100 && <Link href="/verification" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">{it.completeIt} <ArrowRight size={14} aria-hidden /></Link>}
            </section>
            <section className="rounded-[14px] border border-line bg-surface p-4">
              <h2 className="font-display font-bold">{it.skills}</h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {skills.map((id) => <li key={id}><Link href={`/explore?category=${id}`} className="inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent hover:underline">{q.short[id]}</Link></li>)}
              </ul>
            </section>
            <section className="rounded-[14px] border border-line bg-surface p-2">
              <h2 className="px-2 pt-2 font-display font-bold">{it.shortcuts}</h2>
              <ul className="mt-1">
                {[
                  { href: "/my-tasks", label: q.myOffers, Icon: ClipboardList },
                  { href: "/messages", label: q.messages, Icon: MessageSquare },
                  { href: "/wallet", label: q.earnings, Icon: Wallet },
                  { href: `/passport/${user.id}`, label: q.passport, Icon: FileBadge2 },
                  { href: "/verification", label: q.verify, Icon: ShieldCheck },
                ].map(({ href, label, Icon }) => (
                  <li key={href}><Link href={href} className="flex items-center gap-3 rounded-md px-2 py-2.5 text-[0.95rem] font-semibold hover:bg-accent-soft"><Icon size={18} aria-hidden className="text-accent" /> {label}</Link></li>
                ))}
              </ul>
            </section>
            <Link href="/explore" className="block text-sm font-semibold text-accent hover:underline">{it.allWork} →</Link>
          </aside>
        </div>
      ) : working ? (
        <>
          <Group id="q-work" title={q.yourWork} wide tiles={[
            { href: "/explore", label: q.findTasks, Icon: Search, accent: true },
            { href: "/my-tasks", label: q.myOffers, Icon: ClipboardList },
            { href: "/messages", label: q.messages, Icon: MessageSquare },
            { href: "/wallet", label: q.earnings, Icon: Wallet },
            { href: `/passport/${user.id}`, label: q.passport, Icon: FileBadge2 },
            { href: "/verification", label: q.verify, Icon: ShieldCheck },
            { href: "/safety", label: q.safety, Icon: ShieldAlert },
            { href: "/contact", label: q.help, Icon: LifeBuoy },
          ]} />
          {skills.length > 0 && (
            <Group id="q-skills" title={q.yourSkills} wide
              tiles={skills.slice(0, 7).map((id) => ({ href: `/explore?category=${id}`, label: q.short[id], Icon: CATEGORY_ICONS[id] }))}
              all={{ href: "/explore", label: q.all }} />
          )}
        </>
      ) : (
        <QuickGrid t={t} lang={lang} isProvider={false} stacked />
      )}

      {/* a few tasks: nearby (hiring) or matching your skills (working) */}
      {!itHome && <section aria-labelledby="near-h" className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="near-h" className="font-display text-lg font-bold sm:text-xl">{working && skills.length ? q.forYou : near}</h2>
          <Link href="/explore" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">{q.seeMap} <ArrowRight size={16} aria-hidden /></Link>
        </div>
        {tasks.length ? (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {tasks.map((x) => <li key={x.id}><TaskRow task={x} t={t} lang={lang} /></li>)}
          </ul>
        ) : (
          <p className="mt-3 text-muted">{working ? q.noSkillTasks : t.explore.empty}</p>
        )}
      </section>}
    </div>
  );
}
