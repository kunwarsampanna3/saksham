/**
 * Business rules in plain code (never the AI): ranking, counters, escrow, credit.
 * Kept pure so they are easy to unit-test and to show users "why".
 */

/* ------------------------------------------------------------- ranking */
export interface BidForRanking {
  amount: number;
  rating: number; // 0..5
  distanceKm: number | null; // null = online
  verified: boolean;
  jobs: number;
}

/** 1.0 at or under the fair midpoint, falling to 0 at 1.6× the high end; mildly penalises suspiciously low bids. */
export function priceFit(amount: number, range: { low: number; high: number; mid: number }): number {
  if (amount <= 0) return 0;
  if (amount < range.low * 0.6) return 0.6; // too-good-to-be-true
  if (amount <= range.mid) return 1;
  const ceiling = range.high * 1.6;
  return Math.max(0, 1 - (amount - range.mid) / (ceiling - range.mid));
}

/** 1.0 within 2 km, 0 beyond 25 km; online work scores 0.9. */
export function distanceFit(km: number | null): number {
  if (km === null) return 0.9;
  if (km <= 2) return 1;
  return Math.max(0, 1 - (km - 2) / 23);
}

/** Machine-readable reasons so the UI can phrase them in Nepali or English. */
export type ReasonCode =
  | { k: "below" }
  | { k: "within" }
  | { k: "above" }
  | { k: "tooLow" }
  | { k: "rating"; v: number }
  | { k: "online" }
  | { k: "near"; v: number }
  | { k: "verified" }
  | { k: "jobs"; v: number };

export interface Ranked<T> {
  bid: T;
  score: number;
  parts: { price: number; rating: number; distance: number; verified: number };
  reason: string;
  reasons: ReasonCode[];
}

/** score = 0.35 price fit + 0.30 rating/5 + 0.20 distance fit + 0.15 verified */
export function rankBids<T extends BidForRanking>(
  bids: T[],
  range: { low: number; high: number; mid: number },
): Ranked<T>[] {
  return bids
    .map((bid) => {
      const parts = {
        price: priceFit(bid.amount, range),
        rating: Math.min(Math.max(bid.rating, 0), 5) / 5,
        distance: distanceFit(bid.distanceKm),
        verified: bid.verified ? 1 : 0,
      };
      const score = 0.35 * parts.price + 0.3 * parts.rating + 0.2 * parts.distance + 0.15 * parts.verified;
      const reasons = reasonCodes(bid, parts, range);
      return { bid, score: Math.round(score * 1000) / 1000, parts, reasons, reason: reasonFor(reasons) };
    })
    .sort((a, b) => b.score - a.score || a.bid.amount - b.bid.amount);
}

function reasonCodes(
  b: BidForRanking,
  p: Ranked<BidForRanking>["parts"],
  range: { low: number; mid: number },
): ReasonCode[] {
  const r: ReasonCode[] = [];
  if (b.amount < range.low * 0.6) r.push({ k: "tooLow" });
  else if (p.price === 1) r.push(b.amount <= range.mid * 0.9 ? { k: "below" } : { k: "within" });
  else if (p.price < 0.7) r.push({ k: "above" });
  if (b.rating >= 4.5) r.push({ k: "rating", v: b.rating });
  if (b.distanceKm === null) r.push({ k: "online" });
  else if (b.distanceKm <= 3) r.push({ k: "near", v: b.distanceKm });
  if (b.verified) r.push({ k: "verified" });
  if (b.jobs >= 10) r.push({ k: "jobs", v: b.jobs });
  return r.slice(0, 3);
}

/** English one-liner (logs, AI context). The UI renders the codes in the viewer's language. */
function reasonFor(codes: ReasonCode[]): string {
  const en = codes.map((c) => {
    switch (c.k) {
      case "below":
        return "below the fair midpoint";
      case "within":
        return "within the fair range";
      case "above":
        return "priced above the fair range";
      case "tooLow":
        return "unusually low for this job";
      case "rating":
        return `rated ${c.v.toFixed(1)}`;
      case "online":
        return "online";
      case "near":
        return `${c.v.toFixed(1)} km away`;
      case "verified":
        return "verified";
      case "jobs":
        return `${c.v} jobs done`;
    }
  });
  const s = en.join(", ");
  return s ? s[0].toUpperCase() + s.slice(1) + "." : "Balanced on price, rating and distance.";
}

/* ---------------------------------------------------------------- offers */
/**
 * What an offer may be. Once a counter is accepted, the agreed price is the ceiling.
 * Before that: 10× the fair range, or double the posted price if that is higher, so the posted price and the
 * "+5/10/20%" buttons always work.
 */
export function offerLimits(fairHigh: number, budget: number | null, agreed?: number) {
  return { min: 100, max: agreed ?? Math.min(10_000_000, Math.max(fairHigh * 10, (budget ?? 0) * 2)) };
}

/* ------------------------------------------------------------- counters */
/** A counter-offer is auto-acceptable when within ~7% of the provider's bid. */
export const COUNTER_TOLERANCE = 0.07;
export const counterWithinTolerance = (bid: number, counter: number) =>
  counter >= bid * (1 - COUNTER_TOLERANCE);

/* --------------------------------------------------------------- escrow */
export type EscrowState = "scheduled" | "held" | "delivered" | "released" | "refunded";
const ESCROW_NEXT: Record<EscrowState, EscrowState[]> = {
  scheduled: ["held"],
  held: ["delivered", "refunded"],
  delivered: ["released", "refunded"],
  released: [],
  refunded: [],
};
export const canMoveEscrow = (from: EscrowState, to: EscrowState) => ESCROW_NEXT[from].includes(to);

/* --------------------------------------------------------------- credit */
export type CreditInput =
  | { kind: "applicant"; verifiedEarnings: number; completedJobs: number; rating: number }
  | { kind: "recruiter"; releasedSpend: number; posts: number };

export interface CreditOffer {
  kind: CreditInput["kind"];
  eligible: boolean;
  limit: number;
  /** Jobs completed (applicant) or jobs posted (recruiter) */
  count: number;
  need: number;
  remaining: number; // more jobs or posts needed
  /** Verified earnings (applicant) or money released to applicants (recruiter) */
  money: number;
  base: number; // 15% of money, rounded to Rs. 1,000
  halved: boolean; // applicant rating below 4.5
  capped: boolean; // hit Rs. 100,000
}

export const CREDIT_RULES = {
  pct: 0.15,
  minJobs: 10,
  minPosts: 50,
  fullRating: 4.5,
  cap: 100_000,
} as const;

/**
 * Saksham Credit.
 *  - Applicant: 10 completed jobs. 15% of verified earnings, half below a 4.5 rating.
 *  - Recruiter: 50 jobs posted. 15% of what they have released to applicants.
 * Both round to Rs. 1,000 and stop at Rs. 100,000.
 */
export function creditOffer(input: CreditInput): CreditOffer {
  const worker = input.kind === "applicant";
  const count = worker ? input.completedJobs : input.posts;
  const need = worker ? CREDIT_RULES.minJobs : CREDIT_RULES.minPosts;
  const money = worker ? input.verifiedEarnings : input.releasedSpend;
  const base = Math.round((money * CREDIT_RULES.pct) / 1000) * 1000;
  const remaining = Math.max(0, need - count);

  const halved = worker && remaining === 0 && input.rating < CREDIT_RULES.fullRating;
  const raw = remaining > 0 ? 0 : halved ? Math.round((base * 0.5) / 1000) * 1000 : base;
  const limit = Math.min(raw, CREDIT_RULES.cap);
  return {
    kind: input.kind,
    eligible: limit > 0,
    limit,
    count,
    need,
    remaining,
    money,
    base,
    halved,
    capped: raw > CREDIT_RULES.cap,
  };
}

/** Example repayment (equal monthly installments, reducing balance). The rate is an EXAMPLE, labelled on screen. */
export const EXAMPLE_CREDIT_RATE = 0.14; // 14% a year — example only
export function monthlyInstallment(amount: number, months: number, yearlyRate = EXAMPLE_CREDIT_RATE): number {
  const r = yearlyRate / 12;
  return Math.round((amount * r) / (1 - Math.pow(1 + r, -months)));
}
