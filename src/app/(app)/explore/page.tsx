import type { Metadata } from "next";
import Link from "next/link";
import { Contours } from "@/components/contours";
import { FilterBar } from "@/components/browse/filters";
import { ResultsLayout } from "@/components/browse/results-layout";
import { TaskCard, ProviderCard } from "@/components/browse/cards";
import type { Pin } from "@/components/map/map";
import { requireUser } from "@/lib/auth/current-user";
import { canSeeWomenOnly } from "@/lib/store";
import { getCity, getDict } from "@/lib/i18n/server";
import { parseFilters, filtersToQuery, searchProviders } from "@/lib/search";
import { searchTasks } from "@/lib/task-search";

export const metadata: Metadata = { title: "Explore" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Explore({ searchParams }: { searchParams: SP }) {
  const [user, { t, lang }, sp] = await Promise.all([requireUser("/explore"), getDict(), searchParams]);
  const f = parseFilters(sp, await getCity(user.city), "tasks");
  const e = t.explore;
  const women = canSeeWomenOnly(user);

  const tasks = f.view === "tasks" ? await searchTasks(f, user) : [];
  const pros = f.view === "pros" ? searchProviders(f) : [];
  const n = f.view === "tasks" ? tasks.length : pros.length;

  const pins: Pin[] = f.view === "tasks"
    ? tasks.filter((x) => x.coords).map((x) => ({ id: x.id, lat: x.coords![0], lng: x.coords![1], kind: "task" as const, label: x.title[lang], sub: `${x.area ? `${x.area}, ` : ""}${x.city}`, href: `/task/${x.id}` }))
    : pros.map((p) => ({ id: p.id, lat: p.coords[0], lng: p.coords[1], kind: "provider" as const, label: p.name, sub: `${p.area}, ${p.city}`, href: `/profile/${p.id}` }));

  const tab = (v: "tasks" | "pros") => filtersToQuery({ ...f, view: v, women: false, verified: v === "pros" ? f.verified : false });
  const count = e.count(n, f.view === "tasks" ? e.tasksWord : e.prosWord);

  return (
    <div className="relative">
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={31} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pb-6 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{e.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{e.lead}</p>

          <nav aria-label={e.title} className="mt-6 inline-flex rounded-[5px] border border-line-strong bg-surface p-1">
            {(["tasks", "pros"] as const).map((v) => (
              <Link key={v} href={`/explore${tab(v)}`} aria-current={f.view === v ? "page" : undefined}
                className={`min-h-10 rounded-[4px] px-4 py-2 text-[0.95rem] font-semibold ${f.view === v ? "bg-accent text-accent-contrast" : "hover:text-accent"}`}>
                {e.tabs[v]}
              </Link>
            ))}
          </nav>

          <div className="mt-5">
            <FilterBar key={f.view} f={f} canSeeWomenOnly={women} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] px-4 pb-10 sm:px-6">
        <ResultsLayout
          t={t}
          count={count}
          pins={pins}
          emptyHref={`/explore?view=${f.view}`}
          note={f.view === "tasks" ? (women ? undefined : e.womenHidden) : `${t.browse.exampleNote} ${f.sort === "best" ? e.bestReason : ""}`}
        >
          {n > 0 ? (
            <ul className={`grid gap-4 ${f.view === "tasks" ? "md:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-2"}`}>
              {f.view === "tasks"
                ? tasks.map((x) => <li key={x.id}><TaskCard task={x} t={t} lang={lang} /></li>)
                : pros.map((p) => <li key={p.id}><ProviderCard p={p} t={t} lang={lang} /></li>)}
            </ul>
          ) : null}
        </ResultsLayout>
      </div>
    </div>
  );
}
