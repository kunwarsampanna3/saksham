import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import type { Booking, PayMethod, User } from "@/lib/store/types";
import { creditOffer, type CreditOffer } from "@/lib/rules";
import { getProvider } from "@/lib/seed/providers";
import { config } from "@/lib/config";
import { RuleError } from "@/lib/tasks";
import { notify } from "@/lib/chat";

/**
 * Wallet numbers are derived from escrow (bookings + receipts) — never typed in.
 *  - Provider: released money minus the example 7% fee is "earned"; minus payouts it is "available".
 *  - Earnings Passport: completed jobs, verified earnings (money released through escrow), average rating.
 *  - Saksham Credit: plain-code formula in rules.ts; the partner and application are DEMO only.
 */
export interface WalletSummary {
  provider: { releasedGross: number; fees: number; earnedNet: number; inEscrow: number; scheduled: number; paidOut: number; available: number };
  client: { paidIn: number; inEscrow: number; released: number; refunded: number };
  receipts: { id: string; bookingId: string; taskTitle: string; kind: "hold" | "release" | "refund"; amount: number; fee: number; receiptNo: string; createdAt: string; role: "client" | "provider" }[];
  payouts: { id: string; amount: number; method: PayMethod; ref: string; createdAt: string }[];
  passport: Passport;
  examplePassport: Passport | null;
  credit: CreditOffer;
  exampleCredit: CreditOffer | null;
  applications: { id: string; amount: number; months: number; createdAt: string }[];
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

const PERSONA: Record<string, { slug: string; earnings: number }> = {
  "9800000002": { slug: "bikash-tamang", earnings: 118_000 },
  "9800000003": { slug: "aasha-tailoring-group", earnings: 392_000 },
};

export async function passportFor(user: User): Promise<Passport> {
  const bookings = (await store.listBookings()).filter((b) => b.providerId === user.id);
  const completed = bookings.filter((b) => b.status === "completed");
  const verifiedEarnings = bookings.flatMap((b) => b.installments).filter((i) => i.state === "released").reduce((a, i) => a + i.amount, 0);
  const ratings = await store.listRatingsFor(user.id);
  const cats = new Set<string>();
  for (const b of completed) { const t = await store.getTask(b.taskId); if (t) cats.add(t.category); }
  return {
    completedJobs: completed.length,
    verifiedEarnings,
    rating: ratings.length ? Math.round((ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) * 10) / 10 : 0,
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
    completedJobs: p.jobsDone, verifiedEarnings: m.earnings, rating: p.rating, ratingCount: p.ratingCount, categories: p.categories,
    since: `${p.memberSince}-01T00:00:00.000Z`, verified: true, isExample: true,
  };
}

const sum = (b: Booking[], states: string[]) => b.flatMap((x) => x.installments).filter((i) => states.includes(i.state)).reduce((a, i) => a + i.amount, 0);

export async function walletFor(user: User): Promise<WalletSummary> {
  const all = await store.listBookings();
  const asProvider = all.filter((b) => b.providerId === user.id);
  const asClient = all.filter((b) => b.clientId === user.id);

  const receipts: WalletSummary["receipts"] = [];
  for (const b of [...asClient, ...asProvider]) {
    const task = await store.getTask(b.taskId);
    const role = b.clientId === user.id ? "client" : "provider";
    for (const r of await store.listReceipts(b.id)) {
      receipts.push({ id: r.id, bookingId: b.id, taskTitle: task?.title ?? "", kind: r.kind, amount: r.amount, fee: r.fee, receiptNo: r.receiptNo, createdAt: r.createdAt, role });
    }
  }
  receipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const fees = (await Promise.all(asProvider.map((b) => store.listReceipts(b.id)))).flat().filter((r) => r.kind === "release").reduce((a, r) => a + r.fee, 0);
  const releasedGross = sum(asProvider, ["released"]);
  const payouts = (await store.listPayouts(user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const paidOut = payouts.reduce((a, p) => a + p.amount, 0);
  const earnedNet = releasedGross - fees;

  const passport = await passportFor(user);
  const ex = examplePassport(user);
  const apps = (await store.listCreditApplications(user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    provider: {
      releasedGross, fees, earnedNet, inEscrow: sum(asProvider, ["held", "delivered"]), scheduled: sum(asProvider.filter((b) => b.status === "active"), ["scheduled"]),
      paidOut, available: Math.max(0, earnedNet - paidOut),
    },
    client: {
      paidIn: sum(asClient, ["held", "delivered", "released", "refunded"]), inEscrow: sum(asClient, ["held", "delivered"]),
      released: sum(asClient, ["released"]), refunded: sum(asClient, ["refunded"]),
    },
    receipts: receipts.slice(0, 50),
    payouts: payouts.map((p) => ({ id: p.id, amount: p.amount, method: p.method, ref: p.ref, createdAt: p.createdAt })),
    passport,
    examplePassport: ex,
    credit: creditOffer({ verifiedEarnings: passport.verifiedEarnings, completedJobs: passport.completedJobs, rating: passport.rating }),
    exampleCredit: ex ? creditOffer({ verifiedEarnings: ex.verifiedEarnings, completedJobs: ex.completedJobs, rating: ex.rating }) : null,
    applications: apps.map((a) => ({ id: a.id, amount: a.amount, months: a.months, createdAt: a.createdAt })),
  };
}

/* ------------------------------------------------------------------ actions */
export async function requestPayout(user: User, amount: number, method: PayMethod) {
  if (!user.roles.includes("provider")) throw new RuleError("provider_only", 403);
  const w = await walletFor(user);
  if (amount < 100) throw new RuleError("payout_min", 422, { field: "amount" });
  if (amount > w.provider.available) throw new RuleError("payout_too_much", 422, { field: "amount" });
  const p = await store.putPayout({
    id: randomUUID(), userId: user.id, amount: Math.round(amount), method,
    ref: `${method === "esewa_sandbox" ? "ESEWA" : "KHALTI"}-PAYOUT-SBX-${randomBytes(4).toString("hex").toUpperCase()}`,
    status: "sent_sandbox", createdAt: new Date().toISOString(),
  });
  await notify(user.id, "payment", "payout_sent", { amount: p.amount }, "/wallet");
  return p;
}

/** Demo partner application. Validates against the plain-code offer; nothing leaves Saksham. */
export async function applyForCredit(user: User, amount: number, months: 3 | 6 | 12, purpose: string, useExample: boolean) {
  const w = await walletFor(user);
  const offer = useExample && w.exampleCredit ? w.exampleCredit : w.credit;
  if (!offer.eligible) throw new RuleError("credit_not_eligible", 403);
  if (amount < 1000 || amount > offer.limit) throw new RuleError("credit_amount", 422, { field: "amount" });
  const a = await store.putCreditApplication({
    id: randomUUID(), userId: user.id, amount: Math.round(amount / 1000) * 1000, months, purpose, limitAtApply: offer.limit,
    status: "submitted_demo", createdAt: new Date().toISOString(),
  });
  await notify(user.id, "system", "credit_applied", { amount: a.amount }, "/wallet#credit");
  return a;
}

export async function rateBooking(user: User, b: Booking, stars: number, text: string) {
  if (b.clientId !== user.id) throw new RuleError("forbidden", 403);
  if (b.status !== "completed") throw new RuleError("not_completed");
  if (await store.getRatingByBooking(b.id)) throw new RuleError("already_rated");
  const r = await store.putRating({
    id: randomUUID(), bookingId: b.id, taskId: b.taskId, raterId: user.id, rateeId: b.providerId,
    stars: Math.min(5, Math.max(1, Math.round(stars))), text, createdAt: new Date().toISOString(),
  });
  await notify(b.providerId, "system", "rated", { stars: r.stars }, "/wallet#passport");
  return r;
}
