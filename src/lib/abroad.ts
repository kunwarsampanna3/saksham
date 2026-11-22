import "server-only";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import type { AbroadJob, Booking, PostPayment, Task, User } from "@/lib/store/types";
import { postPhase } from "@/lib/business";
import type { JobCountry } from "@/lib/geo";
import type { CategoryId } from "@/lib/pricing";
import { jobProgress, type JobProgress } from "@/lib/abroad-state";
import { createBooking } from "@/lib/escrow";
import { isBlocked, maskContacts, notify } from "@/lib/chat";
import { RuleError } from "@/lib/tasks";
import { statusFor } from "@/lib/verification";

/**
 * Hire Nepalis who already live abroad.
 *  - One job can need several workers. Each hire is its own task + escrow booking, paid by Visa (sandbox), so
 *    release, disputes, receipts, ratings, chat and the Passport work exactly as they do for other work.
 *  - Saksham doesn't send workers abroad: applicants confirm they live there and may work there.
 * Callers hold the lock `abroad:<job id>` around every change and read the job inside it.
 */
const now = () => new Date().toISOString();
const link = (job: AbroadJob) => `/abroad/jobs/${job.id}`;

export interface NewJob {
  title: string;
  details: string;
  category: CategoryId;
  country: JobCountry;
  city: string;
  workersNeeded: number;
  days: number;
  payPerWorker: number;
}

export interface JobView extends JobProgress {
  job: AbroadJob;
}

const byTask = (bookings: Booking[]) => new Map(bookings.map((b) => [b.taskId, b]));

export async function progressOf(job: AbroadJob): Promise<JobProgress> {
  return jobProgress(job, byTask(await store.listBookings()));
}

/** Demo accounts and real accounts never see each other's jobs. */
export const canSeeJob = (job: AbroadJob, viewer: User) => job.isDemo === viewer.isDemo;

export async function postJob(user: User, input: NewJob, post: PostPayment): Promise<AbroadJob> {
  if (!user.roles.includes("client")) throw new RuleError("client_only", 403);
  const title = maskContacts(input.title).text;
  return store.putAbroadJob({
    ...input,
    post,
    id: randomUUID(),
    clientId: user.id,
    clientName: user.name,
    isDemo: user.isDemo,
    title,
    details: maskContacts(input.details).text,
    city: maskContacts(input.city).text,
    applications: [],
    createdAt: now(),
    updatedAt: now(),
  });
}

export async function applyToJob(job: AbroadJob, user: User, note: string, eligible: boolean) {
  if (!canSeeJob(job, user)) throw new RuleError("not_found", 404);
  if (!user.roles.includes("provider")) throw new RuleError("provider_only", 403);
  if (job.clientId === user.id) throw new RuleError("own_job", 403);
  if (!eligible) throw new RuleError("eligibility", 422, { field: "eligible" });
  if (await isBlocked(job.clientId, user.id)) throw new RuleError("not_found", 404);
  const kyc = await statusFor(user);
  if (kyc.id.status !== "verified" || kyc.selfie.status !== "verified")
    throw new RuleError("id_required", 403);
  if ((await progressOf(job)).state !== "open") throw new RuleError("not_open");

  const before = job.applications.find((a) => a.userId === user.id);
  if (before && before.status !== "withdrawn") throw new RuleError("already_applied");
  const application = {
    id: before?.id ?? randomUUID(),
    userId: user.id,
    name: user.name,
    note: maskContacts(note).text,
    status: "pending" as const,
    eligibleConfirmedAt: now(),
    createdAt: now(),
  };
  const saved = await store.putAbroadJob({
    ...job,
    applications: [...job.applications.filter((a) => a.userId !== user.id), application],
    updatedAt: now(),
  });
  await notify(job.clientId, "bid", "abroad_applied", { name: user.name, job: job.title }, link(job));
  return { job: saved, application };
}

export async function withdrawApplication(job: AbroadJob, user: User) {
  const a = job.applications.find((x) => x.userId === user.id);
  if (a?.status !== "pending") throw new RuleError("not_pending");
  return store.putAbroadJob({
    ...job,
    applications: job.applications.map((x) => (x.id === a.id ? { ...x, status: "withdrawn" } : x)),
    updatedAt: now(),
  });
}

export async function declineApplication(job: AbroadJob, user: User, applicationId: string) {
  if (job.clientId !== user.id) throw new RuleError("forbidden", 403);
  const a = job.applications.find((x) => x.id === applicationId);
  if (a?.status !== "pending") throw new RuleError("not_pending");
  const saved = await store.putAbroadJob({
    ...job,
    applications: job.applications.map((x) => (x.id === a.id ? { ...x, status: "declined" } : x)),
    updatedAt: now(),
  });
  await notify(a.userId, "bid", "abroad_declined", { job: job.title }, link(job));
  return saved;
}

/** Hire one applicant and pay their 50% advance by Visa (sandbox). */
export async function hire(job: AbroadJob, user: User, applicationId: string) {
  if (job.clientId !== user.id) throw new RuleError("forbidden", 403);
  if ((await progressOf(job)).state !== "open") throw new RuleError("not_open");
  const a = job.applications.find((x) => x.id === applicationId);
  if (a?.status !== "pending") throw new RuleError("not_pending");
  const kyc = await statusFor(user);
  if (kyc.id.status !== "verified" || kyc.selfie.status !== "verified")
    throw new RuleError("kyc_required", 403);
  const worker = await store.getUserById(a.userId);
  // They may have replaced their ID, been suspended or blocked the recruiter since applying.
  if (!worker?.verified || worker.suspended) throw new RuleError("worker_unverified");
  if (await isBlocked(user.id, worker.id)) throw new RuleError("blocked", 403);

  const at = now();
  const taskId = randomUUID();
  const bidId = randomUUID();
  const task: Task = {
    id: taskId,
    clientId: user.id,
    clientName: user.name,
    isExample: false,
    category: job.category,
    title: job.title,
    titleNe: job.titleNe,
    details: job.details,
    quantity: 1,
    days: job.days,
    city: `${job.city}, ${job.country}`,
    online: false,
    womenOnly: false,
    budget: job.payPerWorker,
    fairLow: job.payPerWorker,
    fairHigh: job.payPerWorker,
    flexible: true,
    abroad: { jobId: job.id, workerId: worker.id, country: job.country },
    photos: [],
    aiSource: "manual",
    status: "assigned",
    acceptedBidId: bidId,
    agreedPrice: job.payPerWorker,
    createdAt: at,
    updatedAt: at,
  };
  await store.putTask(task);
  await store.putBid({
    id: bidId,
    taskId,
    providerId: worker.id,
    providerName: worker.name,
    isExample: false,
    amount: job.payPerWorker,
    days: job.days,
    message: a.note,
    status: "accepted",
    appearAt: at,
    createdAt: at,
    updatedAt: at,
  });
  const booking = await createBooking(task, user, "card_sandbox");
  const saved = await store.putAbroadJob({
    ...job,
    applications: job.applications.map((x) => (x.id === a.id ? { ...x, status: "hired", taskId } : x)),
    updatedAt: at,
  });
  await notify(worker.id, "bid", "abroad_hired", { job: job.title, amount: job.payPerWorker }, link(job));

  if ((await progressOf(saved)).state === "filled")
    for (const other of saved.applications)
      if (other.status === "pending")
        await notify(other.userId, "bid", "abroad_filled", { job: job.title }, link(job));
  return { job: saved, booking };
}

export async function closeJob(job: AbroadJob, user: User) {
  if (job.clientId !== user.id) throw new RuleError("forbidden", 403);
  if ((await progressOf(job)).state !== "open") throw new RuleError("not_open");
  return store.putAbroadJob({ ...job, closedAt: now(), updatedAt: now() });
}

export async function reopenJob(job: AbroadJob, user: User) {
  if (job.clientId !== user.id) throw new RuleError("forbidden", 403);
  const p = await progressOf(job);
  if (p.state === "open" || p.seatsLeft === 0 || !canReopen(job)) throw new RuleError("cannot_reopen");
  return store.putAbroadJob({ ...job, closedAt: undefined, reopenedAtDone: p.done, updatedAt: now() });
}

/** Reopening is for the days that were paid for. It is not a way to post again for free. */
export const canReopen = (job: AbroadJob) => !job.removed && postPhase(job.post) !== "expired";

/* ------------------------------------------------------------------ reading */

async function visibleJobs(viewer: User): Promise<JobView[]> {
  const [jobs, bookings] = await Promise.all([store.listAbroadJobs(), store.listBookings()]);
  const index = byTask(bookings);
  return jobs
    .filter((job) => canSeeJob(job, viewer))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((job) => ({ job, ...jobProgress(job, index) }));
}

/** The public list (open jobs only), and the viewer's own jobs whatever their state. */
export async function boardFor(viewer: User, country?: string) {
  const all = await visibleJobs(viewer);
  return {
    open: await withoutSuspended(
      all.filter((v) => v.state === "open" && (!country || v.job.country === country)),
    ),
    mine: all.filter(
      (v) =>
        v.job.clientId === viewer.id ||
        v.job.applications.some((a) => a.userId === viewer.id && a.status !== "withdrawn"),
    ),
  };
}

async function withoutSuspended(views: JobView[]) {
  const owners = await Promise.all(views.map((v) => store.getUserById(v.job.clientId)));
  return views.filter((_, i) => !owners[i]?.suspended);
}

export interface WorkRecord {
  view: JobView;
  role: "client" | "provider";
  /** The worker's own hire. Absent on a recruiter's record. */
  booking?: Booking;
  stars?: number;
}

/**
 * The "work abroad" part of a profile: jobs posted, and jobs hired for, kept after they leave the list.
 * `known` is also true for someone who has only applied, so recruiters can open an applicant's profile.
 */
export async function abroadRecord(
  userId: string,
  viewer: User,
): Promise<{ known: boolean; records: WorkRecord[] }> {
  const [views, bookings] = await Promise.all([visibleJobs(viewer), store.listBookings()]);
  const index = byTask(bookings);
  const records: WorkRecord[] = [];
  let known = false;
  for (const view of views) {
    if (view.job.clientId === userId) {
      known = true;
      records.push({ view, role: "client" });
      continue;
    }
    const a = view.job.applications.find((x) => x.userId === userId);
    if (!a) continue;
    known = true;
    const booking = a.status === "hired" && a.taskId ? index.get(a.taskId) : undefined;
    if (!booking || booking.status === "refunded") continue;
    const rating = await store.getRatingByBooking(booking.id);
    records.push({ view, role: "provider", booking, stars: rating?.stars });
  }
  return { known, records };
}
