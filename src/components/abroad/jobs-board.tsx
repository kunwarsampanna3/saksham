import Link from "next/link";
import { CreditCard, Megaphone, Plus, UserCheck, UserRound } from "lucide-react";
import { DemoGuide } from "@/components/abroad/demo-guide";
import { JobCard, countryName } from "@/components/abroad/job-card";
import { boardFor } from "@/lib/abroad";
import { config } from "@/lib/config";
import { DEMO_MPIN } from "@/lib/auth/demo";
import { DEMO_JOBS } from "@/lib/seed/abroad-demo";
import { JOB_COUNTRIES } from "@/lib/geo";
import type { User } from "@/lib/store/types";
import type { Dict, Lang } from "@/lib/i18n/dict";

const STEP_ICONS = [Megaphone, UserCheck, CreditCard, UserRound];

/** "Hire Nepalis abroad": how it works, the viewer's own jobs, and the open list. */
export async function JobsBoard({
  t,
  lang,
  user,
  country,
}: {
  t: Dict;
  lang: Lang;
  user: User;
  country?: string;
}) {
  const j = t.abroadJobs;
  const picked = JOB_COUNTRIES.find((c) => c === country);
  const { open, mine } = await boardFor(user, picked);
  const chip = (value: string | undefined, label: string) => (
    <Link
      key={label}
      href={`/abroad?for=workers${value ? `&country=${encodeURIComponent(value)}` : ""}`}
      scroll={false}
      aria-current={picked === value ? "true" : undefined}
      className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${picked === value ? "border-accent bg-accent text-accent-contrast" : "border-line-strong hover:text-accent"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-8">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {j.steps.map((s, i) => {
          const Icon = STEP_ICONS[i] ?? UserCheck;
          return (
            <li key={s.t} className="border-line bg-surface relative rounded-[14px] border p-5">
              <span className="font-display text-line absolute top-4 right-4 text-3xl font-extrabold">
                {i + 1}
              </span>
              <span className="bg-accent-soft text-accent grid h-11 w-11 place-items-center rounded-xl">
                <Icon size={22} aria-hidden />
              </span>
              <h3 className="font-display mt-3 text-lg font-bold">{s.t}</h3>
              <p className="text-muted mt-1 text-sm">{s.b}</p>
            </li>
          );
        })}
      </ol>
      <p className="border-accent bg-accent-soft rounded-[12px] border-l-4 p-4 text-sm">{j.legal}</p>

      {config.demoMode && user.isDemo && <DemoGuide mpin={DEMO_MPIN} jobs={DEMO_JOBS} />}

      <div className="flex flex-wrap gap-2">
        {user.roles.includes("client") && (
          <Link href="/abroad/jobs/new" className="btn btn-primary">
            <Plus size={18} aria-hidden /> {j.post}
          </Link>
        )}
        <Link href={`/profile/${user.id}`} className="btn btn-ghost">
          <UserRound size={18} aria-hidden /> {j.record.myProfile}
        </Link>
      </div>

      {mine.length > 0 && (
        <section aria-labelledby="abroad-mine-h">
          <h2 id="abroad-mine-h" className="font-display text-2xl font-bold">
            {j.mineTitle}
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-list="mine">
            {mine.map((v) => (
              <li key={v.job.id}>
                <JobCard view={v} t={t} lang={lang} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="abroad-open-h">
        <h2 id="abroad-open-h" className="font-display text-2xl font-bold">
          {j.openTitle}
        </h2>
        <p className="text-muted mt-1 text-sm">{j.openLead}</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {chip(undefined, j.allCountries)}
          {JOB_COUNTRIES.map((c) => chip(c, countryName(t, c)))}
        </div>
        {open.length ? (
          <ul
            className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            data-list="open"
            data-jobs={open.map((v) => v.job.id).join(" ")}
          >
            {open.map((v) => (
              <li key={v.job.id}>
                <JobCard view={v} t={t} lang={lang} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-line-strong text-muted mt-3 rounded-[12px] border border-dashed p-8 text-center">
            {j.noneOpen}
          </p>
        )}
      </section>
    </div>
  );
}
