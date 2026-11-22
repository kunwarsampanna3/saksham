/**
 * Saksham's business rules: what is charged, to whom, and when. Pure code, shared by the server and the screens,
 * so a number is written once.
 *
 *  Job money
 *    Hire ............. the recruiter pays 50%. Saksham pays the applicant 30% and holds 20%.
 *    Half done ........ the applicant says so, the recruiter pays the other 50%, Saksham pays the applicant 30%.
 *    Finished ......... the recruiter approves and Saksham pays the last 40%.
 *    Withdrawing ...... Saksham keeps 7% of the income withdrawn.
 *
 *  Posts
 *    Rs 1,000 for 3 days or Rs 4,000 for 10 days. Nobody hired by then: 5 more days free, then the post is removed.
 */
import { FEE_RATE } from "@/lib/pricing";

const DAY_MS = 86_400_000;

/* ----------------------------------------------------------------- posts */
export const POST_PLANS = [
  { days: 3, fee: 1000 },
  { days: 10, fee: 4000 },
] as const;
export type PostDays = (typeof POST_PLANS)[number]["days"];
export const FREE_EXTRA_DAYS = 5;

export const postFee = (days: PostDays) => POST_PLANS.find((p) => p.days === days)!.fee;

/** When the paid days end, and when the free days end. Fixed at the moment of payment. */
export function postWindow(days: PostDays, paidAt: number) {
  const endsAt = paidAt + days * DAY_MS;
  return {
    endsAt: new Date(endsAt).toISOString(),
    removeAt: new Date(endsAt + FREE_EXTRA_DAYS * DAY_MS).toISOString(),
  };
}

export type PostPhase = "paid" | "free" | "expired";

/** Posts from before posting was paid have no window, and never expire. */
export function postPhase(
  post: { endsAt: string; removeAt: string } | undefined,
  at = Date.now(),
): PostPhase | null {
  if (!post) return null;
  if (at < Date.parse(post.endsAt)) return "paid";
  return at < Date.parse(post.removeAt) ? "free" : "expired";
}

/* ------------------------------------------------------------- job money */
export const ADVANCE = { recruiterPct: 50, startPct: 30, halfPct: 30, finishPct: 40 } as const;

/**
 * The job's money in four pieces that always add up to the total:
 *  advance (30, paid out at hiring) · kept (20, held) · half (10, completes the second 30) · finish (40).
 * The first two are the recruiter's first payment and the last two are their second.
 */
export function splitAdvance(total: number) {
  const firstPayment = Math.ceil((total * ADVANCE.recruiterPct) / 100);
  const advance = Math.floor((total * ADVANCE.startPct) / 100);
  const atHalf = Math.floor((total * ADVANCE.halfPct) / 100);
  const kept = firstPayment - advance;
  return {
    firstPayment,
    secondPayment: total - firstPayment,
    /** What the applicant is paid at each of the three steps */
    payouts: { advance, half: atHalf, finish: total - advance - atHalf },
    pieces: { advance, kept, half: atHalf - kept, finish: total - advance - atHalf },
  };
}

/* ------------------------------------------------------------ withdrawing */
export const WITHDRAW_FEE_RATE = FEE_RATE;
export const MIN_WITHDRAW = 100;

/** What an applicant keeps of a job's pay, wherever the 7% is taken. */
export const netOfFee = (total: number) => total - Math.round(total * FEE_RATE);

/**
 * The 7% on a withdrawal.
 *  - Money from jobs booked under the old rules already paid 7% when it was released, so it leaves first, free.
 *  - Rounding follows the running total, so many small withdrawals cost the same as one big one.
 */
export function withdrawalFee(amount: number, b: { untaxed: number; taxedBefore: number }) {
  const feeBase = Math.max(0, amount - b.untaxed);
  const upTo = (n: number) => Math.round(n * WITHDRAW_FEE_RATE);
  return { feeBase, fee: upTo(b.taxedBefore + feeBase) - upTo(b.taxedBefore) };
}
