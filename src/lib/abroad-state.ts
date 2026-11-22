import type { AbroadJob, Booking } from "@/lib/store/types";
import { postPhase } from "@/lib/business";

/** open: listed. Everything else: off the list, still on both profiles. */
export type JobState = "open" | "filled" | "completed" | "closed" | "expired" | "removed";

export interface JobProgress {
  state: JobState;
  hired: number;
  done: number;
  seatsLeft: number;
}

/**
 * Where a job stands, worked out from its hires' bookings so it can never disagree with the money.
 *  - completed: everyone hired has finished and been paid, even if places were left (the recruiter may reopen).
 *  - filled: every place is taken.
 *  - A refunded hire frees the place again.
 */
export function jobProgress(
  job: AbroadJob,
  bookingByTask: ReadonlyMap<string, Pick<Booking, "status">>,
): JobProgress {
  let hired = 0;
  let done = 0;
  for (const a of job.applications) {
    if (a.status !== "hired" || !a.taskId) continue;
    const status = bookingByTask.get(a.taskId)?.status;
    if (status === "refunded") continue;
    hired++;
    if (status === "completed") done++;
  }
  const seatsLeft = Math.max(0, job.workersNeeded - hired);
  const finished = hired > 0 && done === hired;
  // Reopening says "the work finished so far doesn't close it"; the next finish does.
  const state: JobState =
    finished && (seatsLeft === 0 || done > (job.reopenedAtDone ?? 0))
      ? "completed"
      : job.removed
        ? "removed"
        : job.closedAt
          ? "closed"
          : seatsLeft === 0
            ? "filled"
            : postPhase(job.post) === "expired"
              ? "expired"
              : "open";
  return { state, hired, done, seatsLeft };
}
