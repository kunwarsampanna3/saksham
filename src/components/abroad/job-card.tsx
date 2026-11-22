import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { CATEGORY_ICONS } from "@/components/category-icons";
import type { JobView } from "@/lib/abroad";
import type { JobState } from "@/lib/abroad-state";
import { EXAMPLE_FX, type JobCountry } from "@/lib/geo";
import { category, type CategoryId } from "@/lib/pricing";
import { num, rs } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dict";

const STATE_STYLE: Record<JobState, string> = {
  open: "bg-accent-soft text-accent",
  filled: "bg-marigold text-ink",
  completed: "bg-accent text-accent-contrast",
  closed: "bg-surface-2 text-muted",
};

export function JobStateBadge({ state, t }: { state: JobState; t: Dict }) {
  return (
    <span className={`rounded-[3px] px-2 py-0.5 text-xs font-bold ${STATE_STYLE[state]}`}>
      {t.abroadJobs.states[state]}
    </span>
  );
}

export const countryName = (t: Dict, country: string) =>
  t.abroadJobs.countries[country as JobCountry] ?? country;

/** "About QAR 2,027", from the example rates. */
export function localPay(t: Dict, lang: Lang, country: string, npr: number): string | null {
  const fx = EXAMPLE_FX[country as JobCountry];
  return fx ? t.abroadJobs.approx(fx.code, num(Math.max(1, Math.round(npr / fx.nprPer)), lang)) : null;
}

/** Places taken out of places needed. */
export function Seats({ view, t, lang }: { view: JobView; t: Dict; lang: Lang }) {
  const label = t.abroadJobs.seats(num(view.hired, lang), num(view.job.workersNeeded, lang));
  return (
    <div>
      <div className="flex justify-between gap-2 text-sm font-semibold">
        <span>{label}</span>
        {view.state === "open" && (
          <span className="text-accent">{t.abroadJobs.left(num(view.seatsLeft, lang))}</span>
        )}
      </div>
      <div className="bg-line mt-1.5 h-2 overflow-hidden rounded-full" aria-hidden>
        <div
          className="bg-accent h-full rounded-full"
          style={{ width: `${Math.min(100, (view.hired / view.job.workersNeeded) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function JobCard({ view, t, lang }: { view: JobView; t: Dict; lang: Lang }) {
  const { job } = view;
  const j = t.abroadJobs;
  const c = category(job.category as CategoryId);
  const Icon = CATEGORY_ICONS[job.category as CategoryId] ?? CATEGORY_ICONS.other;
  const waiting = job.applications.filter((a) => a.status === "pending").length;
  const local = localPay(t, lang, job.country, job.payPerWorker);
  return (
    <article className="border-line bg-surface flex h-full flex-col gap-3 rounded-[14px] border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-accent inline-flex items-center gap-1.5 text-sm font-semibold">
          <Icon size={15} aria-hidden /> {lang === "ne" ? c.ne : c.en}
        </span>
        <span className="flex items-center gap-1.5">
          {job.isDemo && <span className="demo-tag">{t.browse.example}</span>}
          <JobStateBadge state={view.state} t={t} />
        </span>
      </div>
      <div>
        <h3 className="font-display text-lg leading-snug font-bold">
          <Link href={`/abroad/jobs/${job.id}`} className="hover:text-accent">
            {lang === "ne" && job.titleNe ? job.titleNe : job.title}
          </Link>
        </h3>
        <p className="text-muted mt-1 flex flex-wrap items-center gap-x-2 text-sm">
          <MapPin size={14} aria-hidden /> {job.city}, {countryName(t, job.country)}
          <span>· {j.days(num(job.days, lang))}</span>
          <span>· {j.by(job.clientName.split(" ")[0])}</span>
        </p>
      </div>
      <p>
        <span className="font-display text-2xl font-extrabold">{rs(job.payPerWorker, lang)}</span>{" "}
        <span className="text-muted text-sm">{j.perWorker}</span>
        {local && <span className="text-muted block text-sm">{local}</span>}
      </p>
      <Seats view={view} t={t} lang={lang} />
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-muted text-sm">
          {view.state === "open" ? j.applied(num(waiting, lang)) : ""}
        </span>
        <Link href={`/abroad/jobs/${job.id}`} className="btn btn-ghost !min-h-10">
          {j.view} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </article>
  );
}
