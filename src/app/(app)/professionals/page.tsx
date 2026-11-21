import type { Metadata } from "next";
import Link from "next/link";
import { Gavel, Plus } from "lucide-react";
import { Contours } from "@/components/contours";
import { FilterBar } from "@/components/browse/filters";
import { ResultsLayout } from "@/components/browse/results-layout";
import { ProviderCard } from "@/components/browse/cards";
import { requireUser } from "@/lib/auth/current-user";
import { EXAMPLE_PROVIDERS } from "@/lib/seed/providers";
import { realProviders } from "@/lib/real-providers";
import { getCity, getDict } from "@/lib/i18n/server";
import { parseFilters, searchProviders } from "@/lib/search";

export const metadata: Metadata = { title: "Professionals" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Professionals({ searchParams }: { searchParams: SP }) {
  const [user, { t, lang }, sp] = await Promise.all([requireUser("/professionals"), getDict(), searchParams]);
  const f = { ...parseFilters(sp, await getCity(user.city), "pros"), view: "pros" as const };
  const pros = searchProviders(f, user.isDemo ? EXAMPLE_PROVIDERS : await realProviders());
  const p = t.pros;

  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={45} centers={1} rings={8} />
        <span
          lang="ne"
          aria-hidden
          className="deva-giant absolute top-2 -right-4 text-[7rem] sm:text-[11rem]"
        >
          सीप
        </span>
        <div className="relative mx-auto max-w-[88rem] px-4 pt-10 pb-6 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{p.title}</h1>
          <p className="text-muted mt-2 max-w-2xl text-lg">{p.lead}</p>

          <section
            aria-labelledby="bid-h"
            className="border-line bg-surface mt-6 flex flex-col gap-4 rounded-[6px] border p-5 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <h2 id="bid-h" className="font-display flex items-center gap-2 text-xl font-bold">
                <Gavel size={20} aria-hidden className="text-accent" /> {p.bidTitle}
              </h2>
              <p className="text-muted mt-1 max-w-2xl">{p.bidLead}</p>
              <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                {p.bidSteps.map((s, i) => (
                  <li key={s} className="inline-flex items-center gap-2">
                    <span
                      className="bg-accent text-accent-contrast grid h-6 w-6 place-items-center rounded-full text-xs"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <Link href="/post" className="btn btn-primary shrink-0">
              <Plus size={18} aria-hidden /> {p.bidCta}
            </Link>
          </section>

          <div className="mt-6">
            <FilterBar f={f} showView={false} canSeeWomenOnly={false} />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 pb-10 sm:px-6">
        <ResultsLayout
          t={t}
          count={t.explore.count(pros.length, t.explore.prosWord)}
          pins={pros.map((x) => ({
            id: x.id,
            lat: x.coords[0],
            lng: x.coords[1],
            kind: "provider" as const,
            label: x.name,
            sub: `${x.area}, ${x.city}`,
            href: `/profile/${x.id}`,
          }))}
          emptyHref="/professionals"
          note={
            `${user.isDemo ? t.browse.exampleNote : ""} ${f.sort === "best" ? t.explore.bestReason : ""}`.trim() ||
            undefined
          }
        >
          {pros.length ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {pros.map((x) => (
                <li key={x.id}>
                  <ProviderCard p={x} t={t} lang={lang} />
                </li>
              ))}
            </ul>
          ) : null}
        </ResultsLayout>
      </div>
    </div>
  );
}
