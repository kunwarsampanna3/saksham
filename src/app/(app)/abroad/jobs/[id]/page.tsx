import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CreditCard, MapPin, Wallet } from "lucide-react";
import { Contours } from "@/components/contours";
import { JobStateBadge, Seats, countryName, localPay } from "@/components/abroad/job-card";
import { ApplyForm, HireButton, JobActionButton } from "@/components/abroad/job-actions";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import type { Booking } from "@/lib/store/types";
import { canReopen, canSeeJob, type JobView } from "@/lib/abroad";
import { splitAdvance } from "@/lib/business";
import { PostNotice } from "@/components/post/post-notice";
import { jobProgress } from "@/lib/abroad-state";
import { statusFor } from "@/lib/verification";
import { num, rs } from "@/lib/format";

export const metadata: Metadata = { title: "Job abroad" };
export const dynamic = "force-dynamic";

function payState(b: Booking) {
  if (b.status === "refunded") return "refunded" as const;
  if (b.status === "disputed") return "disputed" as const;
  if (b.status === "completed") return "released" as const;
  if (b.installments.some((i) => i.state === "delivered")) return "delivered" as const;
  if (b.plan === "advance") {
    if (b.installments.some((i) => i.label === "half" && i.state === "released")) return "second" as const;
    if (b.halfDoneAt) return "half" as const;
  }
  return "held" as const;
}

export default async function AbroadJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { t, lang }] = await Promise.all([requireUser(`/abroad/jobs/${id}`), getDict()]);
  const job = /^[0-9a-f-]{36}$/.test(id) ? await store.getAbroadJob(id) : null;
  if (!job || !canSeeJob(job, user)) notFound();

  const [allBookings, kyc] = await Promise.all([store.listBookings(), statusFor(user)]);
  const bookings = new Map(allBookings.map((b) => [b.taskId, b]));
  const view: JobView = { job, ...jobProgress(job, bookings) };
  const open = view.state === "open";
  const kycDone = kyc.id.status === "verified" && kyc.selfie.status === "verified";
  const owner = job.clientId === user.id;
  const mine = job.applications.find((a) => a.userId === user.id);
  const myBooking = mine?.taskId ? bookings.get(mine.taskId) : undefined;
  const applicants = job.applications.filter((a) => a.status !== "withdrawn");

  const j = t.abroadJobs;
  const title = lang === "ne" && job.titleNe ? job.titleNe : job.title;
  const details = lang === "ne" && job.detailsNe ? job.detailsNe : job.details;
  const country = countryName(t, job.country);
  const local = localPay(t, lang, job.country, job.payPerWorker) ?? undefined;
  const localNow = localPay(t, lang, job.country, splitAdvance(job.payPerWorker).firstPayment) ?? undefined;

  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={24} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pt-6 pb-8 sm:px-6">
          <Link href="/abroad?for=workers" className="btn btn-quiet -ml-2">
            <ArrowLeft size={16} aria-hidden /> {j.back}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <JobStateBadge state={view.state} t={t} />
            {job.isDemo && <span className="demo-tag">{t.browse.example}</span>}
          </div>
          <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-5xl">{title}</h1>
          <p className="text-muted mt-2 flex flex-wrap items-center gap-x-2 text-lg">
            <MapPin size={17} aria-hidden /> {job.city}, {country}
            <span>· {j.days(num(job.days, lang))}</span>
            <Link href={`/profile/${job.clientId}`} className="text-accent font-semibold hover:underline">
              {j.by(job.clientName)}
            </Link>
          </p>
        </div>
      </div>

      <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-8 max-lg:order-2">
          <PostNotice
            post={job.post}
            removed={owner ? job.removed : undefined}
            owner={owner}
            waiting={open || view.state === "expired"}
            againHref="/abroad/jobs/new"
            t={t}
            lang={lang}
          />
          {view.state !== "open" && (
            <p
              role="status"
              className="border-accent bg-accent-soft rounded-[12px] border-l-4 p-4 font-semibold"
            >
              {j.removed[view.state]}
            </p>
          )}
          {details && (
            <section aria-labelledby="job-about-h">
              <h2 id="job-about-h" className="font-display text-2xl font-bold">
                {j.about}
              </h2>
              <p className="mt-2 max-w-3xl whitespace-pre-line">{details}</p>
            </section>
          )}
          {owner && (
            <section aria-labelledby="job-apps-h">
              <h2 id="job-apps-h" className="font-display text-2xl font-bold">
                {j.applicants} <span className="text-muted">({num(applicants.length, lang)})</span>
              </h2>
              {applicants.length === 0 && <p className="text-muted mt-3">{j.noApplicants}</p>}
              {open && !kycDone && (
                <p className="bg-surface-2 mt-3 flex flex-wrap items-center gap-3 rounded-[12px] p-4 text-sm">
                  {j.errors.kyc_required}
                  <Link href="/verification" className="btn btn-ghost !min-h-9">
                    {j.verify}
                  </Link>
                </p>
              )}
              <ul className="mt-3 space-y-3">
                {applicants.map((a) => {
                  const booking = a.taskId ? bookings.get(a.taskId) : undefined;
                  const state = booking && payState(booking);
                  return (
                    <li
                      key={a.id}
                      data-applicant={a.name}
                      className="border-line bg-surface rounded-[14px] border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Link
                          href={`/profile/${a.userId}`}
                          className="font-display hover:text-accent text-lg font-bold"
                        >
                          {a.name}
                        </Link>
                        <span
                          className={`rounded-[3px] px-2 py-0.5 text-xs font-bold ${a.status === "hired" ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"}`}
                        >
                          {state ? j.pay[state] : j.app[a.status]}
                        </span>
                      </div>
                      {a.note && <p className="text-muted mt-1 text-sm whitespace-pre-line">{a.note}</p>}
                      <div className="mt-3 flex flex-wrap items-start gap-2">
                        {a.status === "pending" && open && (
                          <>
                            {kycDone && (
                              <HireButton
                                jobId={job.id}
                                applicationId={a.id}
                                amount={job.payPerWorker}
                                title={title}
                                workerName={a.name}
                                seat={view.hired + 1}
                                seats={job.workersNeeded}
                                approx={localNow}
                              />
                            )}
                            <JobActionButton jobId={job.id} action="decline" applicationId={a.id} />
                          </>
                        )}
                        {booking && (
                          <Link
                            href={`/payments/${booking.id}`}
                            className={`btn !min-h-10 ${state === "delivered" || state === "half" ? "btn-primary" : "btn-ghost"}`}
                          >
                            <Wallet size={16} aria-hidden />{" "}
                            {state === "delivered" ? j.release : state === "half" ? j.paySecond : j.payment}
                          </Link>
                        )}
                        <Link href={`/profile/${a.userId}`} className="btn btn-quiet !min-h-10">
                          {j.profile}
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <p className="text-muted text-sm">{j.legal}</p>
        </div>

        <aside className="max-lg:order-1">
          <div className="border-line bg-surface space-y-4 rounded-[14px] border p-5">
            <div>
              <p className="font-display text-3xl font-extrabold">{rs(job.payPerWorker, lang)}</p>
              <p className="text-muted text-sm">{j.perWorker}</p>
              {local && (
                <p className="text-muted text-sm">
                  {local} · <span className="text-xs">{j.rateNote}</span>
                </p>
              )}
            </div>
            <p className="font-semibold">{j.needed(num(job.workersNeeded, lang))}</p>
            <Seats view={view} t={t} lang={lang} />
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard size={17} aria-hidden className="text-accent" /> {j.visa}
              <span className="demo-tag">{t.common.sandbox}</span>
            </p>

            {owner && open && <JobActionButton jobId={job.id} action="close" />}
            {owner && !open && view.seatsLeft > 0 && canReopen(job) && (
              <JobActionButton jobId={job.id} action="reopen" />
            )}

            {!owner && mine?.status === "hired" && myBooking && (
              <div className="border-line space-y-3 border-t pt-4">
                <p className="flex gap-2 font-semibold">
                  <CheckCircle2 size={18} aria-hidden className="text-accent shrink-0" />
                  {payState(myBooking) === "held" ? j.hiredYou : j.pay[payState(myBooking)]}
                </p>
                <Link href={`/payments/${myBooking.id}`} className="btn btn-primary w-full">
                  {payState(myBooking) === "held" ? j.markDone : j.payment}
                </Link>
              </div>
            )}
            {!owner && mine?.status === "pending" && (
              <div className="border-line space-y-2 border-t pt-4">
                <p className="font-semibold">{open ? j.appliedOk : j.errors.not_open}</p>
                <JobActionButton jobId={job.id} action="withdraw" />
              </div>
            )}
            {!owner && mine?.status === "declined" && (
              <p className="border-line border-t pt-4 font-semibold">{j.app.declined}</p>
            )}
            {!owner && open && (!mine || mine.status === "withdrawn") && (
              <div className="border-line border-t pt-4">
                {!user.roles.includes("provider") ? (
                  <p className="text-muted text-sm">{j.switchToApply}</p>
                ) : kycDone ? (
                  <ApplyForm jobId={job.id} country={country} />
                ) : (
                  <p className="text-sm">
                    {j.verifyFirst}{" "}
                    <Link href="/verification" className="text-accent font-semibold hover:underline">
                      {j.verify}
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
