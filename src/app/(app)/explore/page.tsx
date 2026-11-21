import type { Metadata } from "next";
import Link from "next/link";
import { FilterBar } from "@/components/browse/filters";
import { ResultsLayout } from "@/components/browse/results-layout";
import { TaskRow, ProviderCard } from "@/components/browse/cards";
import type { Pin } from "@/components/map/map";
import { requireUser } from "@/lib/auth/current-user";
import { EXAMPLE_PROVIDERS } from "@/lib/seed/providers";
import { realProviders } from "@/lib/real-providers";
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
  const pros =
    f.view === "pros" ? searchProviders(f, user.isDemo ? EXAMPLE_PROVIDERS : await realProviders()) : [];
  const n = f.view === "tasks" ? tasks.length : pros.length;

  const pins: Pin[] =
    f.view === "tasks"
      ? tasks
          .filter((x) => x.coords)
          .map((x) => ({
            id: x.id,
            lat: x.coords![0],
            lng: x.coords![1],
            kind: "task" as const,
            label: x.title[lang],
            sub: `${x.area ? `${x.area}, ` : ""}${x.city}`,
            href: `/task/${x.id}`,
          }))
      : pros.map((p) => ({
          id: p.id,
          lat: p.coords[0],
          lng: p.coords[1],
          kind: "provider" as const,
          label: p.name,
          sub: `${p.area}, ${p.city}`,
          href: `/profile/${p.id}`,
        }));

  const tab = (v: "tasks" | "pros") =>
    filtersToQuery({ ...f, view: v, women: false, verified: v === "pros" ? f.verified : false });
  const count = e.count(n, f.view === "tasks" ? e.tasksWord : e.prosWord);

  return (
    <div className="relative">
      {/* Slim toolbar like a classic task marketplace: tabs + one row of filters, stuck under the header. */}
      <div className="border-line bg-bg/95 supports-[backdrop-filter]:bg-bg/85 sticky top-[var(--header-h)] z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
          <h1 className="sr-only">{e.title}</h1>
          <nav
            aria-label={e.title}
            className="border-line-strong bg-surface inline-flex rounded-full border p-1"
          >
            {(["tasks", "pros"] as const).map((v) => (
              <Link
                key={v}
                href={`/explore${tab(v)}`}
                aria-current={f.view === v ? "page" : undefined}
                className={`rounded-full px-4 py-1.5 text-[0.93rem] font-semibold ${f.view === v ? "bg-accent text-accent-contrast" : "hover:text-accent"}`}
              >
                {e.tabs[v]}
              </Link>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            <FilterBar key={f.view} f={f} canSeeWomenOnly={women} compact />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] px-4 pb-10 sm:px-6">
        <ResultsLayout
          split
          t={t}
          count={count}
          pins={pins}
          emptyHref={`/explore?view=${f.view}`}
          note={
            f.view === "tasks"
              ? women
                ? undefined
                : e.womenHidden
              : `${user.isDemo ? t.browse.exampleNote : ""} ${f.sort === "best" ? e.bestReason : ""}`.trim() ||
                undefined
          }
        >
          {n > 0 ? (
            <ul className="grid gap-3">
              {f.view === "tasks"
                ? tasks.map((x) => (
                    <li key={x.id}>
                      <TaskRow task={x} t={t} lang={lang} />
                    </li>
                  ))
                : pros.map((p) => (
                    <li key={p.id}>
                      <ProviderCard p={p} t={t} lang={lang} />
                    </li>
                  ))}
            </ul>
          ) : null}
        </ResultsLayout>
      </div>
    </div>
  );
}
