import Link from "next/link";
import { Plane, Star } from "lucide-react";
import { JobStateBadge, countryName } from "@/components/abroad/job-card";
import type { WorkRecord } from "@/lib/abroad";
import { netOfFee } from "@/lib/business";
import { num, npDate, rs } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dict";

/** "Work abroad" on a profile. Jobs stay here after they leave the public list. Pay is shown only to the worker. */
export function AbroadWorkRecord({
  records,
  self,
  t,
  lang,
}: {
  records: WorkRecord[];
  self: boolean;
  t: Dict;
  lang: Lang;
}) {
  const r = t.abroadJobs.record;
  const isDone = (x: WorkRecord) =>
    x.role === "provider" ? x.booking?.status === "completed" : x.view.state === "completed";
  const groups = [
    { title: r.current, list: records.filter((x) => !isDone(x)) },
    { title: r.finished, list: records.filter(isDone) },
  ];
  return (
    <section aria-labelledby="work-abroad-h">
      <h2 id="work-abroad-h" className="font-display flex items-center gap-2 text-2xl font-bold">
        <Plane size={22} aria-hidden className="text-accent" /> {r.title}
      </h2>
      <p className="text-muted mt-1 text-sm">{r.lead}</p>
      {records.length === 0 && <p className="text-muted mt-4">{r.none}</p>}
      {groups.map(
        ({ title, list }) =>
          list.length > 0 && (
            <div key={title} className="mt-5">
              <h3 className="text-muted text-xs font-bold tracking-wider uppercase">
                {title} ({num(list.length, lang)})
              </h3>
              <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                {list.map(({ view, role, booking, stars }) => {
                  const { job } = view;
                  const finished = role === "provider" && booking?.status === "completed";
                  return (
                    <li key={job.id} className="border-leaf bg-surface border-l-4 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted text-xs font-bold uppercase">
                          {role === "client" ? r.asClient : r.asProvider}
                        </span>
                        <JobStateBadge state={finished ? "completed" : view.state} t={t} />
                      </div>
                      <Link
                        href={`/abroad/jobs/${job.id}`}
                        className="font-display hover:text-accent mt-1 block text-lg font-bold"
                      >
                        {lang === "ne" && job.titleNe ? job.titleNe : job.title}
                      </Link>
                      <p className="text-muted text-sm">
                        {job.city}, {countryName(t, job.country)} · {npDate(job.createdAt, lang)}
                      </p>
                      {role === "client" && (
                        <p className="mt-1 text-sm font-semibold">
                          {t.abroadJobs.seats(num(view.hired, lang), num(job.workersNeeded, lang))}
                        </p>
                      )}
                      {stars !== undefined && (
                        <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
                          <Star size={15} aria-hidden className="fill-marigold text-marigold" />{" "}
                          {num(stars, lang)}/{num(5, lang)}
                        </p>
                      )}
                      {self && finished && booking && (
                        <p className="text-accent mt-1 text-sm font-semibold">
                          {r.earned(rs(netOfFee(booking.total), lang))}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}
    </section>
  );
}
