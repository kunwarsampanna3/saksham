import "server-only";
import { z } from "zod";
import { store } from "@/lib/store";
import type { PostPayment } from "@/lib/store/types";
import { POST_PLANS, postFee, postPhase, postWindow, type PostDays } from "@/lib/business";
import { receiptNo, sandboxRef } from "@/lib/payments";
import { withLock } from "@/lib/lock";
import { notify } from "@/lib/chat";

/**
 * Paid posts (see business.ts). The fee is taken when the post is made and is not refunded.
 * Callers hold `post:<user>` while they look for a repeated request and save the post.
 */
export const PostChoice = z.object(
  {
    requestId: z.string().uuid(),
    days: z.union([z.literal(POST_PLANS[0].days), z.literal(POST_PLANS[1].days)]),
    /** The fee on the recruiter's screen. It must be the real fee, or nothing is charged. */
    fee: z.number().int().positive(),
    method: z.enum(["esewa_sandbox", "khalti_sandbox", "card_sandbox"]),
  },
  { message: "post_payment_required" },
);
export type PostChoice = z.infer<typeof PostChoice>;

export const feeMatches = (c: PostChoice) => c.fee === postFee(c.days as PostDays);

export function payForPost(c: PostChoice, at = Date.now()): PostPayment {
  return {
    requestId: c.requestId,
    days: c.days,
    fee: postFee(c.days),
    method: c.method,
    ref: sandboxRef(c.method),
    receiptNo: receiptNo(),
    paidAt: new Date(at).toISOString(),
    ...postWindow(c.days, at),
  };
}

/* ------------------------------------------------------------- the clock */
/** Which notice is due. Each is sent once. */
function due(post: PostPayment | undefined) {
  const phase = postPhase(post);
  if (phase === "free" && !post!.freeNotifiedAt) return "free" as const;
  if (phase === "expired" && !post!.expiredNotifiedAt) return "expired" as const;
  return null;
}

async function sweepTask(id: string) {
  await withLock(`task:${id}`, async () => {
    const task = await store.getTask(id);
    if (!task?.clientId || task.status !== "open") return;
    const step = due(task.post);
    if (!step) return;
    const at = new Date().toISOString();
    if (step === "free") {
      await store.putTask({ ...task, post: { ...task.post!, freeNotifiedAt: at } });
      await notify(task.clientId, "system", "post_free", { task: task.title }, `/task/${id}`);
      return;
    }
    for (const bid of await store.listBids(id)) {
      if (bid.status !== "active") continue;
      const counter =
        bid.counter?.status === "pending" ? { ...bid.counter, status: "declined" as const } : bid.counter;
      await store.putBid({ ...bid, counter, status: "declined", updatedAt: at });
      if (!bid.isExample)
        await notify(bid.providerId, "bid", "post_gone", { task: task.title }, `/task/${id}`);
    }
    await store.putTask({
      ...task,
      status: "expired",
      updatedAt: at,
      post: { ...task.post!, expiredNotifiedAt: at },
    });
    await notify(task.clientId, "system", "post_expired", { task: task.title }, `/task/${id}`);
  });
}

async function sweepJob(id: string) {
  await withLock(`abroad:${id}`, async () => {
    const job = await store.getAbroadJob(id);
    if (!job || job.removed || job.closedAt) return;
    const step = due(job.post);
    if (!step) return;
    const at = new Date().toISOString();
    const key = step === "free" ? "freeNotifiedAt" : "expiredNotifiedAt";
    await store.putAbroadJob({ ...job, post: { ...job.post!, [key]: at } });
    // A full job isn't told that nobody was hired.
    if (job.applications.filter((a) => a.status === "hired").length >= job.workersNeeded) return;
    const href = `/abroad/jobs/${id}`;
    await notify(job.clientId, "system", `post_${step}`, { task: job.title }, href);
    if (step === "expired")
      for (const a of job.applications)
        if (a.status === "pending") await notify(a.userId, "bid", "post_gone", { task: job.title }, href);
  });
}

async function sweep() {
  for (const t of await store.listTasks()) if (t.status === "open" && due(t.post)) await sweepTask(t.id);
  for (const j of await store.listAbroadJobs()) if (due(j.post)) await sweepJob(j.id);
}

/**
 * Sends the "free days" and "removed" notices: at server start, then every five minutes.
 * Being late never matters: every read already treats a post past its time as expired (post-state.ts).
 */
export function startPostClock() {
  const g = globalThis as { __sakshamPostClock?: NodeJS.Timeout };
  if (g.__sakshamPostClock) return;
  const run = () => void sweep().catch((e) => console.error("[saksham] Post expiry check failed.", e));
  g.__sakshamPostClock = setInterval(run, 5 * 60_000);
  g.__sakshamPostClock.unref();
  run();
}
