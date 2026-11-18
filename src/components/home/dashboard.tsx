import Link from "next/link";
import { ArrowRight, BadgeCheck, MapPin, Plus, ShieldCheck } from "lucide-react";
import { QuickGrid } from "@/components/home/quick-grid";
import { TaskRow } from "@/components/browse/cards";
import { parseFilters } from "@/lib/search";
import { searchTasks } from "@/lib/task-search";
import { ANYWHERE } from "@/lib/geo";
import type { Dict, Lang } from "@/lib/i18n/dict";
import type { User } from "@/lib/store/types";

/**
 * Signed-in home, eSewa style: everything separated into clear cards.
 * Greeting → your shortcuts → skill groups → a few tasks nearby (the full map lives on Browse tasks).
 */
export async function Dashboard({ t, lang, user, city }: { t: Dict; lang: Lang; user: User; city: string }) {
  const q = t.home.quick;
  const l = t.home.live;
  const tasks = (await searchTasks(parseFilters({}, city, "tasks"), user)).slice(0, 4);
  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const near = city === "Online" ? l.online : city === ANYWHERE ? l.everywhere : l.near(city);

  return (
    <div className="mx-auto max-w-[72rem] space-y-4 px-3 py-5 sm:px-6 sm:py-8">
      {/* greeting */}
      <section aria-label={t.home.hello(user.name)} className="flex flex-wrap items-center gap-4 rounded-[14px] bg-forest p-5 text-white sm:p-6">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-leaf font-display text-xl font-extrabold text-forest" aria-hidden>{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-extrabold leading-tight">{t.home.hello(user.name)}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
            <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {user.city}</span>
            {user.verified
              ? <span className="inline-flex items-center gap-1 font-semibold text-leaf"><BadgeCheck size={15} aria-hidden /> {q.verifiedYes}</span>
              : <Link href="/verification" className="inline-flex items-center gap-1 font-semibold text-leaf underline-offset-4 hover:underline"><ShieldCheck size={15} aria-hidden /> {q.verifyNow}</Link>}
          </p>
        </div>
        <Link href="/post" className="btn !min-h-12 w-full rounded-full bg-leaf px-6 font-bold text-forest hover:brightness-105 sm:w-auto">
          <Plus size={18} aria-hidden /> {q.post}
        </Link>
      </section>

      {/* separated icon cards */}
      <QuickGrid t={t} lang={lang} isProvider={user.roles.includes("provider")} stacked />

      {/* a few tasks nearby */}
      <section aria-labelledby="near-h" className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="near-h" className="font-display text-lg font-bold sm:text-xl">{near}</h2>
          <Link href="/explore" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">{q.seeMap} <ArrowRight size={16} aria-hidden /></Link>
        </div>
        {tasks.length ? (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {tasks.map((x) => <li key={x.id}><TaskRow task={x} t={t} lang={lang} /></li>)}
          </ul>
        ) : (
          <p className="mt-3 text-muted">{t.explore.empty}</p>
        )}
      </section>
    </div>
  );
}
