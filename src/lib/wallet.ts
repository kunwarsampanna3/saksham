import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import type { Booking, CreditApplication, CreditKind, PayMethod, Payout, User } from "@/lib/store/types";
import { creditOffer, type CreditOffer } from "@/lib/rules";
import { MIN_WITHDRAW, WITHDRAW_FEE_RATE, withdrawalFee } from "@/lib/business";
import { getProvider } from "@/lib/seed/providers";
import { config } from "@/lib/config";
import { RuleError } from "@/lib/tasks";
import { notify } from "@/lib/chat";
import { getControls } from "@/lib/controls";

/**
 * Wallet numbers are derived from escrow (bookings + receipts) — never typed in.
 *  - Provider: released money is "available" until withdrawn. The 7% comes out when it is withdrawn.
 *    (Bookings from before paid their 7% at release, and that money is withdrawn without another fee.)
 *  - Earnings Passport: completed jobs, verified earnings (money released through escrow), average rating.
 *  - Saksham Credit: plain-code formula in rules.ts; the partner and application are DEMO only.
 */
export interface CreditState extends CreditOffer {
  /** Applied for and not declined */
  used: number;
  /** Still open to apply for */
  left: number;
}

export interface WalletSummary {
  provider: {
    releasedGross: number;
    /** 7% already taken */
    fees: number;
    /** What all released money comes to after the 7% */
    earnedNet: number;
    inEscrow: number;
    scheduled: number;
    /** What reached them */
    received: number;
    /** Balance, before the 7% */
    available: number;
    /** For the fee preview: see withdrawalFee() */
    untaxed: number;
    taxedBefore: number;
  };
  client: { paidIn: number; inEscrow: number; released: number; refunded: number };
  receipts: {
    id: string;
    bookingId: string;
    taskTitle: string;
    kind: "hold" | "release" | "refund";
    amount: number;
    fee: number;
    receiptNo: string;
    createdAt: string;
    role: "client" | "provider";
  }[];
  payouts: {
    id: string;
    amount: number;
    fee: number;
    method: PayMethod;
    ref: string;
    status: Payout["status"];
    reason: string;
    createdAt: string;
  }[];
  passport: Passport;
  examplePassport: Passport | null;
  credit: Record<CreditKind, CreditState>;
  exampleCredit: Record<CreditKind, CreditState | null>;
  applications: {
    id: string;
    kind: CreditKind;
    amount: number;
    months: number;
    status: CreditApplication["status"];
    createdAt: string;
  }[];
}

export interface Passport {
  completedJobs: number;
  verifiedEarnings: number;
  rating: number;
  ratingCount: number;
  categories: string[];
  since: string;
  verified: boolean;
  isExample: boolean;
}

/** Demo recruiters get a labelled example history, so recruiter credit can be reviewed without 50 real posts. */
const EXAMPLE_RECRUITER: Record<string, { posts: number; releasedSpend: number }> = {
  "9800000001": { posts: 56, releasedSpend: 240_000 },
  "9800000004": { posts: 52, releasedSpend: 380_000 },
};

const PERSONA: Record<string, { slug: string; earnings: number }> = {
  "9800000002": { slug: "bikash-tamang", earnings: 118_000 },
  "9800000003": { slug: "aasha-tailoring-group", earnings: 392_000 },
};

export async function passportFor(user: User): Promise<Passport> {
  const bookings = (await store.listBookings()).filter((b) => b.providerId === user.id);
  const completed = bookings.filter((b) => b.status === "completed");
  const verifiedEarnings = bookings
    .flatMap((b) => b.installments)
    .filter((i) => i.state === "released")
    .reduce((a, i) => a + i.amount, 0);
  const ratings = await store.listRatingsFor(user.id);
  const cats = new Set<string>();
  for (const b of completed) {
    const t = await store.getTask(b.taskId);
    if (t) cats.add(t.category);
  }
  return {
    completedJobs: completed.length,
    verifiedEarnings,
    rating: ratings.length
      ? Math.round((ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) * 10) / 10
      : 0,
    ratingCount: ratings.length,
    categories: [...cats],
    since: user.createdAt,
    verified: !!user.verified,
    isExample: false,
  };
}

/** Demo personas also get a clearly labelled EXAMPLE Passport so the credit card can be reviewed. */
function examplePassport(user: User): Passport | null {
  if (!config.demoMode || !user.isDemo) return null;
  const m = PERSONA[user.phone];
  const p = m ? getProvider(m.slug) : null;
  if (!m || !p) return null;
  return {
    completedJobs: p.jobsDone,
    verifiedEarnings: m.earnings,
    rating: p.rating,
    ratingCount: p.ratingCount,
    categories: p.categories,
    since: `${p.memberSince}-01T00:00:00.000Z`,
    verified: true,
    isExample: true,
  };
}

const sum = (b: Booking[], states: string[]) =>
  b
    .flatMap((x) => x.installments)
    .filter((i) => states.includes(i.state))
    .reduce((a, i) => a + i.amount, 0);

/** How many jobs a recruiter has posted. Posts an admin took down, and cancelled ones, don't count. */
async function postsBy(user: User) {
  const [tasks, jobs] = await Promise.all([store.listTasks(), store.listAbroadJobs()]);
  return (
    tasks.filter((t) => t.clientId === user.id && !t.abroad && !t.removed && t.status !== "cancelled")
      .length + jobs.filter((j) => j.clientId === user.id && !j.removed).length
  );
}

export async function walletFor(user: User): Promise<WalletSummary> {
  const all = await store.listBookings();
  const asProvider = all.filter((b) => b.providerId === user.id);
  const asClient = all.filter((b) => b.clientId === user.id);

  const receipts: WalletSummary["receipts"] = [];
  for (const b of [...asClient, ...asProvider]) {
    const task = await store.getTask(b.taskId);
    const role = b.clientId === user.id ? "client" : "provider";
    for (const r of await store.listReceipts(b.id)) {
      receipts.push({
        id: r.id,
        bookingId: b.id,
        taskTitle: task?.title ?? "",
        kind: r.kind,
        amount: r.amount,
        fee: r.fee,
        receiptNo: r.receiptNo,
        createdAt: r.createdAt,
        role,
      });
    }
  }
  receipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const releaseFees = (await Promise.all(asProvider.map((b) => store.listReceipts(b.id))))
    .flat()
    .filter((r) => r.kind === "release")
    .reduce((a, r) => a + r.fee, 0);
  const releasedGross = sum(asProvider, ["released"]);
  const payouts = (await store.listPayouts(user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // A withdrawal waiting for the Super Admin keeps its amount reserved; a rejected one gives it back.
  const reserved = payouts.filter(holdsBalance);
  const sent = payouts.filter((p) => p.status === "sent_sandbox");
  const paidOut = reserved.reduce((a, p) => a + p.amount, 0);
  const withdrawFees = sent.reduce((a, p) => a + (p.fee ?? 0), 0);
  const taxedBefore = reserved.reduce((a, p) => a + (p.feeBase ?? 0), 0);
  const balance = Math.max(0, releasedGross - releaseFees - paidOut);
  // Money that hasn't paid its 7% yet: released on bookings that don't charge at release.
  const taxable = sum(
    asProvider.filter((b) => !b.feeRate),
    ["released"],
  );
  const untaxed = Math.max(0, balance - Math.max(0, taxable - taxedBefore));

  const passport = await passportFor(user);
  const ex = examplePassport(user);
  const apps = (await store.listCreditApplications(user.id)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const withUsed = (offer: CreditOffer): CreditState => {
    const used = apps
      .filter((a) => (a.kind ?? "applicant") === offer.kind && a.status !== "declined_demo")
      .reduce((n, a) => n + a.amount, 0);
    return { ...offer, used, left: Math.max(0, offer.limit - used) };
  };
  const exRecruiter = config.demoMode && user.isDemo ? EXAMPLE_RECRUITER[user.phone] : undefined;

  return {
    provider: {
      releasedGross,
      fees: releaseFees + withdrawFees,
      earnedNet: releasedGross - releaseFees - Math.round(taxable * WITHDRAW_FEE_RATE),
      inEscrow: sum(asProvider, ["held", "delivered"]),
      scheduled: sum(
        asProvider.filter((b) => b.status === "active"),
        ["scheduled"],
      ),
      received: sent.reduce((a, p) => a + p.amount, 0) - withdrawFees,
      available: balance,
      untaxed,
      taxedBefore,
    },
    client: {
      paidIn: sum(asClient, ["held", "delivered", "released", "refunded"]),
      inEscrow: sum(asClient, ["held", "delivered"]),
      released: sum(asClient, ["released"]),
      refunded: sum(asClient, ["refunded"]),
    },
    receipts: receipts.slice(0, 50),
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: p.amount,
      fee: p.fee ?? 0,
      method: p.method,
      ref: p.ref,
      status: p.status,
      reason: p.status === "rejected" ? (p.review?.reason ?? "") : "",
      createdAt: p.createdAt,
    })),
    passport,
    examplePassport: ex,
    credit: {
      applicant: withUsed(
        creditOffer({
          kind: "applicant",
          verifiedEarnings: passport.verifiedEarnings,
          completedJobs: passport.completedJobs,
          rating: passport.rating,
        }),
      ),
      recruiter: withUsed(
        creditOffer({
          kind: "recruiter",
          releasedSpend: sum(asClient, ["released"]),
          posts: await postsBy(user),
        }),
      ),
    },
    exampleCredit: {
      applicant: ex
        ? withUsed(
            creditOffer({
              kind: "applicant",
              verifiedEarnings: ex.verifiedEarnings,
              completedJobs: ex.completedJobs,
              rating: ex.rating,
            }),
          )
        : null,
      recruiter: exRecruiter ? withUsed(creditOffer({ kind: "recruiter", ...exRecruiter })) : null,
    },
    applications: apps.map((a) => ({
      id: a.id,
      kind: a.kind ?? "applicant",
      amount: a.amount,
      months: a.months,
      status: a.status,
      createdAt: a.createdAt,
    })),
  };
}

/** Still counted against the balance: sent, or waiting for the Super Admin. */
export const holdsBalance = (p: Pick<Payout, "status">) => p.status !== "rejected";

/** Withdrawals wait for the Super Admin unless Super Admin → Settings turned that off. */
export const payoutReviewOn = async () => (await getControls()).payoutReview !== false;

/* ------------------------------------------------------------------ actions */
export async function requestPayout(user: User, amount: number, method: PayMethod) {
  if (!user.roles.includes("provider")) throw new RuleError("provider_only", 403);
  const w = await walletFor(user);
  if (amount < MIN_WITHDRAW) throw new RuleError("payout_min", 422, { field: "amount" });
  if (amount > w.provider.available) throw new RuleError("payout_too_much", 422, { field: "amount" });
  const { fee, feeBase } = withdrawalFee(amount, w.provider);
  const review = await payoutReviewOn();
  const p = await store.putPayout({
    id: randomUUID(),
    userId: user.id,
    amount,
    fee,
    feeBase,
    method,
    ref: `${method === "esewa_sandbox" ? "ESEWA" : "KHALTI"}-PAYOUT-SBX-${randomBytes(4).toString("hex").toUpperCase()}`,
    status: review ? "requested" : "sent_sandbox",
    createdAt: new Date().toISOString(),
  });
  await notify(
    user.id,
    "payment",
    review ? "payout_requested" : "payout_sent",
    { amount: p.amount - fee },
    "/wallet",
  );
  return p;
}

/** Demo partner application. Validates against the plain-code offer; nothing leaves Saksham. */
export async function applyForCredit(
  user: User,
  kind: CreditKind,
  amount: number,
  months: 3 | 6 | 12,
  purpose: string,
  useExample: boolean,
) {
  if (!user.roles.includes(kind === "applicant" ? "provider" : "client"))
    throw new RuleError("credit_not_eligible", 403);
  const w = await walletFor(user);
  const offer = (useExample ? w.exampleCredit[kind] : null) ?? w.credit[kind];
  if (!offer.eligible) throw new RuleError("credit_not_eligible", 403);
  if (amount < 1000 || amount > offer.left) throw new RuleError("credit_amount", 422, { field: "amount" });
  const a = await store.putCreditApplication({
    id: randomUUID(),
    userId: user.id,
    kind,
    amount: Math.round(amount / 1000) * 1000,
    months,
    purpose,
    limitAtApply: offer.limit,
    status: "submitted_demo",
    createdAt: new Date().toISOString(),
  });
  await notify(user.id, "system", "credit_applied", { amount: a.amount }, "/wallet#credit");
  return a;
}

export async function rateBooking(user: User, b: Booking, stars: number, text: string) {
  if (b.clientId !== user.id) throw new RuleError("forbidden", 403);
  if (b.status !== "completed") throw new RuleError("not_completed");
  if (await store.getRatingByBooking(b.id)) throw new RuleError("already_rated");
  const r = await store.putRating({
    id: randomUUID(),
    bookingId: b.id,
    taskId: b.taskId,
    raterId: user.id,
    rateeId: b.providerId,
    stars: Math.min(5, Math.max(1, Math.round(stars))),
    text,
    createdAt: new Date().toISOString(),
  });
  await notify(b.providerId, "system", "rated", { stars: r.stars }, "/wallet#passport");
  return r;
}
