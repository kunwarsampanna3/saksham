import "server-only";
import { createHash } from "node:crypto";
import { store } from "@/lib/store";
import type {
  Booking,
  Dispute,
  FinanceEvent,
  FinanceHold,
  Payout,
  PostPayment,
  Receipt,
  Report,
  User,
} from "@/lib/store/types";
import { splitAdvance } from "@/lib/business";
import { CATEGORIES } from "@/lib/pricing";
import { holdsBalance } from "@/lib/wallet";
import { nepalDay } from "@/lib/nepal-time";

/**
 * Read-only money views for /superadmin. Every number is worked out from the records the rest of Saksham writes
 * (bookings and their installments, receipts, payouts, posting fees), so the dashboard can never disagree with
 * what customers and applicants see.
 *
 * What counts as Saksham's revenue: posting fees, the 7% on withdrawals that were SENT, and the 7% that bookings
 * from before took at release. Money in escrow (the 20%, then the 40%) belongs to the applicant under the
 * milestone agreement and is never counted as revenue.
 */

/* ------------------------------------------------------------------ labels */
export type Tone = "good" | "pending" | "bad" | "plain";

export type PayStatus =
  "completed" | "awaiting_second" | "awaiting_approval" | "in_progress" | "on_hold" | "disputed" | "refunded";

export const PAY_STATUS: Record<PayStatus, { label: string; tone: Tone }> = {
  completed: { label: "Completed", tone: "good" },
  awaiting_second: { label: "Awaiting 2nd payment", tone: "pending" },
  awaiting_approval: { label: "Awaiting approval", tone: "pending" },
  in_progress: { label: "In progress", tone: "pending" },
  on_hold: { label: "On hold", tone: "bad" },
  disputed: { label: "Disputed", tone: "bad" },
  refunded: { label: "Refunded", tone: "plain" },
};

export type Stage =
  "advance_paid" | "half_reported" | "second_paid" | "delivered" | "completed" | "refunded" | "old_plan";

export const STAGE: Record<Stage, string> = {
  advance_paid: "1st 50% paid · work started",
  half_reported: "Half done · waiting for 2nd 50%",
  second_paid: "2nd 50% paid · finishing",
  delivered: "Finished · waiting for customer approval",
  completed: "Approved · fully released",
  refunded: "Refunded",
  old_plan: "Earlier payment plan",
};

export type TxnType =
  | "customer_payment"
  | "escrow_deposit"
  | "escrow_release"
  | "applicant_payout"
  | "refund"
  | "payment_failure"
  | "platform_fee";

export const TXN_TYPE: Record<TxnType, { label: string; tone: Tone }> = {
  customer_payment: { label: "Customer payment", tone: "good" },
  escrow_deposit: { label: "Escrow deposit", tone: "pending" },
  escrow_release: { label: "Escrow release", tone: "good" },
  applicant_payout: { label: "Applicant payout", tone: "good" },
  refund: { label: "Refund", tone: "plain" },
  payment_failure: { label: "Payout not sent", tone: "bad" },
  platform_fee: { label: "Platform fee", tone: "good" },
};

export const PAYOUT_STATUS: Record<Payout["status"], { label: string; tone: Tone }> = {
  requested: { label: "Waiting for review", tone: "pending" },
  on_hold: { label: "On hold", tone: "bad" },
  sent_sandbox: { label: "Sent (sandbox)", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
};

export const METHOD: Record<string, string> = {
  esewa_sandbox: "eSewa (sandbox)",
  khalti_sandbox: "Khalti (sandbox)",
  card_sandbox: "Card (sandbox)",
};

export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.en ?? id;

/** A short id people can read out on the phone. Searching accepts it or the full id. */
export const bookingRef = (id: string) => `BK-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
export const payoutRef = (id: string) => `PO-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
const txnId = (...parts: string[]) =>
  `TX-${createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 10).toUpperCase()}`;

/* ------------------------------------------------------------------ shapes */
export interface Person {
  id: string;
  name: string;
  /** A demo account or an example provider: sample data, not a real person's money */
  demo: boolean;
  /** Has an account here (example providers don't) */
  account: boolean;
}

export interface BookingRow {
  id: string;
  ref: string;
  taskId: string;
  title: string;
  category: string;
  customer: Person;
  applicant: Person;
  plan: Booking["plan"];
  method: Booking["method"];
  status: Booking["status"];
  total: number;
  /** Paid in by the customer so far */
  received: number;
  /** What the applicant gets from this booking: the whole price (the 7% comes off at withdrawal) */
  applicantAmount: number;
  held: number;
  released: number;
  refunded: number;
  /** Still to be paid by the customer */
  remaining: number;
  /** What the next step would release to the applicant, and who has to act */
  nextRelease: { amount: number; waitingFor: string } | null;
  payStatus: PayStatus;
  stage: Stage;
  hold: FinanceHold | null;
  demo: boolean;
  disputes: Dispute[];
  receipts: Receipt[];
  createdAt: string;
  updatedAt: string;
}

export interface Txn {
  id: string;
  type: TxnType;
  at: string;
  amount: number;
  bookingId?: string;
  bookingRef?: string;
  payoutId?: string;
  party: string;
  from: string;
  to: string;
  admin: string;
  ref: string;
  note: string;
  demo: boolean;
}

export interface PayoutRow {
  payout: Payout;
  ref: string;
  applicant: Person;
  user: User | null;
  net: number;
  events: FinanceEvent[];
}

/* ------------------------------------------------------------------ helpers */
const sumStates = (b: Booking, ...states: Booking["installments"][number]["state"][]) =>
  b.installments.filter((i) => states.includes(i.state)).reduce((n, i) => n + i.amount, 0);

function stageOf(b: Booking): Stage {
  if (b.status === "refunded") return "refunded";
  if (b.status === "completed") return "completed";
  if (b.plan !== "advance") return "old_plan";
  const finish = b.installments.find((i) => i.label === "finish");
  if (finish?.state === "delivered") return "delivered";
  if (finish?.state === "held") return "second_paid";
  return b.halfDoneAt ? "half_reported" : "advance_paid";
}

function payStatusOf(b: Booking, stage: Stage): PayStatus {
  if (b.status === "refunded") return "refunded";
  if (b.status === "completed") return "completed";
  if (b.status === "disputed") return "disputed";
  if (b.financeHold) return "on_hold";
  if (stage === "advance_paid" || stage === "half_reported") return "awaiting_second";
  if (stage === "second_paid" || stage === "delivered") return "awaiting_approval";
  return "in_progress";
}

/** The money still to move on an active booking, and who moves it. Finance can hold it, never trigger it. */
function nextReleaseOf(b: Booking, stage: Stage): BookingRow["nextRelease"] {
  if (b.status !== "active" && b.status !== "disputed") return null;
  if (b.plan === "advance") {
    const s = splitAdvance(b.total);
    if (stage === "advance_paid")
      return { amount: s.payouts.half, waitingFor: "Applicant to report half done" };
    if (stage === "half_reported") return { amount: s.payouts.half, waitingFor: "Customer to pay 2nd 50%" };
    if (stage === "second_paid")
      return { amount: s.payouts.finish, waitingFor: "Applicant to mark finished" };
    if (stage === "delivered") return { amount: s.payouts.finish, waitingFor: "Customer approval" };
    return null;
  }
  const next = b.installments.find((i) => i.state === "held" || i.state === "delivered");
  return next ? { amount: next.amount, waitingFor: "Customer approval" } : null;
}

/** Per hold receipt, the part kept in escrow; the rest went straight to the applicant. */
function heldPart(b: Booking, r: Receipt) {
  if (b.plan !== "advance") return r.amount;
  const s = splitAdvance(b.total);
  const inst = b.installments.find((i) => i.id === r.installmentId);
  return inst?.label === "advance" ? s.pieces.kept : s.payouts.finish;
}

const monthOf = (iso: string) => nepalDay(new Date(iso)).slice(0, 7);

/* ------------------------------------------------------------------ the snapshot */
export async function financeSnapshot() {
  const [users, bookings, tasks, jobs, payouts, events, reports] = await Promise.all([
    store.listUsers(),
    store.listBookings(),
    store.listTasks(),
    store.listAbroadJobs(),
    store.listAllPayouts(),
    store.listFinanceEvents(),
    store.listReports(),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const [receiptLists, disputeLists] = await Promise.all([
    Promise.all(bookings.map((b) => store.listReceipts(b.id))),
    Promise.all(bookings.map((b) => store.listDisputes(b.id))),
  ]);

  const person = (id: string | null, fallback: string, example = false): Person => {
    const u = id ? userById.get(id) : undefined;
    return u
      ? { id: u.id, name: u.name, demo: u.isDemo, account: true }
      : { id: id ?? "", name: fallback, demo: example || !id, account: false };
  };

  const rows: BookingRow[] = bookings.map((b, i) => {
    const task = taskById.get(b.taskId);
    const stage = stageOf(b);
    const customer = person(b.clientId, task?.clientName ?? "—");
    const applicant = person(b.providerIsExample ? null : b.providerId, b.providerName, b.providerIsExample);
    const receipts = [...receiptLists[i]].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    return {
      id: b.id,
      ref: bookingRef(b.id),
      taskId: b.taskId,
      title: task?.title ?? "—",
      category: task ? categoryName(task.category) : "—",
      customer,
      applicant,
      plan: b.plan,
      method: b.method,
      status: b.status,
      total: b.total,
      received: receipts.filter((r) => r.kind === "hold").reduce((n, r) => n + r.amount, 0),
      applicantAmount: b.total - Math.round(b.total * b.feeRate),
      held: sumStates(b, "held", "delivered"),
      released: sumStates(b, "released"),
      refunded: sumStates(b, "refunded"),
      remaining: b.status === "refunded" ? 0 : sumStates(b, "scheduled"),
      nextRelease: nextReleaseOf(b, stage),
      payStatus: payStatusOf(b, stage),
      stage,
      hold: b.financeHold ?? null,
      demo: customer.demo || applicant.demo,
      disputes: disputeLists[i],
      receipts,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    };
  });
  const rowById = new Map(rows.map((r) => [r.id, r]));

  /* payouts, newest first, with the decisions made on them */
  const eventsByPayout = new Map<string, FinanceEvent[]>();
  for (const e of events)
    if (e.payoutId) eventsByPayout.set(e.payoutId, [...(eventsByPayout.get(e.payoutId) ?? []), e]);
  const payoutRows: PayoutRow[] = [...payouts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({
      payout: p,
      ref: payoutRef(p.id),
      applicant: person(p.userId, "—"),
      user: userById.get(p.userId) ?? null,
      net: p.amount - (p.fee ?? 0),
      events: eventsByPayout.get(p.id) ?? [],
    }));

  /* posting fees */
  const posts: {
    id: string;
    title: string;
    clientId: string | null;
    clientName: string;
    post: PostPayment;
  }[] = [...tasks, ...jobs].flatMap((p) =>
    p.post
      ? [{ id: p.id, title: p.title, clientId: p.clientId, clientName: p.clientName, post: p.post }]
      : [],
  );

  /* the ledger */
  const txns: Txn[] = [];
  for (const [i, b] of bookings.entries()) {
    const row = rows[i];
    for (const r of row.receipts) {
      const base = {
        bookingId: b.id,
        bookingRef: row.ref,
        demo: row.demo,
        admin: "System",
        ref: r.receiptNo,
      };
      if (r.kind === "hold") {
        txns.push({
          ...base,
          id: txnId(r.id, "in"),
          type: "customer_payment",
          at: r.createdAt,
          amount: r.amount,
          party: row.customer.name,
          from: "Unpaid",
          to: "Received by Saksham",
          note: `${METHOD[r.method] ?? r.method} · ${r.ref}`,
        });
        const kept = heldPart(b, r);
        if (kept > 0)
          txns.push({
            ...base,
            id: txnId(r.id, "escrow"),
            type: "escrow_deposit",
            at: r.createdAt,
            amount: kept,
            party: row.applicant.name,
            from: "Received",
            to: "Held in escrow",
            note: "Held for the applicant until the next milestone",
          });
      } else if (r.kind === "release") {
        txns.push({
          ...base,
          id: txnId(r.id, "release"),
          type: "escrow_release",
          at: r.createdAt,
          amount: r.amount - r.fee,
          party: row.applicant.name,
          from: "Held / received",
          to: "Applicant wallet",
          note: r.fee ? `After the 7% taken at release (earlier plan)` : "Milestone payment to the applicant",
        });
        if (r.fee > 0)
          txns.push({
            ...base,
            id: txnId(r.id, "fee"),
            type: "platform_fee",
            at: r.createdAt,
            amount: r.fee,
            party: row.applicant.name,
            from: "Held",
            to: "Saksham revenue",
            note: "7% at release (earlier plan)",
          });
      } else {
        const ev = events.find((e) => e.bookingId === b.id && e.action === "dispute_refund");
        txns.push({
          ...base,
          id: txnId(r.id, "refund"),
          type: "refund",
          at: r.createdAt,
          amount: r.amount,
          party: row.customer.name,
          from: "Held in escrow",
          to: "Refunded to customer",
          admin: ev?.adminName ?? "Dispute decision",
          note: "Only money still held is refunded",
        });
      }
    }
  }
  for (const p of payoutRows) {
    const last = p.events.at(-1);
    const base = {
      payoutId: p.payout.id,
      party: p.applicant.name,
      demo: p.applicant.demo,
      ref: p.payout.ref,
      admin: last ? `${last.adminName}` : "System",
    };
    const status = p.payout.status;
    txns.push({
      ...base,
      id: txnId(p.payout.id, "payout"),
      type: status === "rejected" ? "payment_failure" : "applicant_payout",
      at: last?.createdAt ?? p.payout.createdAt,
      amount: p.net,
      from: last ? last.from : "Wallet balance",
      to: PAYOUT_STATUS[status].label,
      note:
        status === "rejected"
          ? `Rejected: ${p.payout.review?.reason ?? ""}`
          : `${METHOD[p.payout.method]} · ${p.ref}`,
    });
    if (status === "sent_sandbox" && (p.payout.fee ?? 0) > 0)
      txns.push({
        ...base,
        id: txnId(p.payout.id, "fee"),
        type: "platform_fee",
        at: last?.createdAt ?? p.payout.createdAt,
        amount: p.payout.fee ?? 0,
        from: "Applicant wallet",
        to: "Saksham revenue",
        note: "7% withdrawal fee",
      });
  }
  for (const p of posts) {
    const owner = p.clientId ? userById.get(p.clientId) : undefined;
    txns.push({
      id: txnId(p.id, "post"),
      type: "platform_fee",
      at: p.post.paidAt,
      amount: p.post.fee,
      party: owner?.name ?? p.clientName,
      from: "Unpaid",
      to: "Saksham revenue",
      admin: "System",
      ref: p.post.receiptNo,
      note: `Posting fee · ${p.post.days} days · ${p.title}`,
      demo: owner?.isDemo ?? true,
    });
  }
  txns.sort((a, b) => b.at.localeCompare(a.at));

  /* totals */
  const sent = payouts.filter((p) => p.status === "sent_sandbox");
  const waiting = payouts.filter((p) => p.status === "requested" || p.status === "on_hold");
  const allReceipts = receiptLists.flat();
  const releasedNet = allReceipts
    .filter((r) => r.kind === "release")
    .reduce((n, r) => n + r.amount - r.fee, 0);
  const revenue = {
    posting: posts.reduce((n, p) => n + p.post.fee, 0),
    withdrawal: sent.reduce((n, p) => n + (p.fee ?? 0), 0),
    release: allReceipts.filter((r) => r.kind === "release").reduce((n, r) => n + r.fee, 0),
  };
  const escrowHeld = rows.reduce((n, r) => n + r.held, 0);
  const reservedOut = payouts.filter(holdsBalance).reduce((n, p) => n + p.amount, 0);
  const sentOut = sent.reduce((n, p) => n + p.amount, 0);
  const overview = {
    received: allReceipts.filter((r) => r.kind === "hold").reduce((n, r) => n + r.amount, 0),
    distributed: releasedNet,
    withdrawn: sentOut - revenue.withdrawal,
    escrowHeld,
    /** Released to applicants and not withdrawn: Saksham still holds it for them */
    inWallets: Math.max(0, releasedNet - reservedOut),
    awaitingPayout: waiting.reduce((n, p) => n + p.amount, 0),
    awaitingPayoutCount: waiting.length,
    heldBySaksham: escrowHeld + Math.max(0, releasedNet - sentOut),
    refunded: rows.reduce((n, r) => n + r.refunded, 0),
    completed: rows.filter((r) => r.status === "completed").length,
    active: rows.filter((r) => r.status === "active").length,
    disputed: rows.filter((r) => r.status === "disputed").length,
    onHold: rows.filter((r) => r.hold).length,
    revenue: revenue.posting + revenue.withdrawal + revenue.release,
    revenueParts: revenue,
  };

  return { users, userById, rows, rowById, payoutRows, txns, events, posts, reports, overview };
}
export type Snapshot = Awaited<ReturnType<typeof financeSnapshot>>;

/* ------------------------------------------------------------------ month by month */
export function monthly(s: Snapshot, months = 6) {
  const keys: string[] = [];
  const d = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15));
    keys.push(m.toISOString().slice(0, 7));
  }
  const blank = () => ({ received: 0, released: 0, refunded: 0, revenue: 0, payouts: 0 });
  const by = new Map(keys.map((k) => [k, blank()]));
  for (const t of s.txns) {
    const m = by.get(monthOf(t.at));
    if (!m) continue;
    if (t.type === "customer_payment") m.received += t.amount;
    else if (t.type === "escrow_release") m.released += t.amount;
    else if (t.type === "refund") m.refunded += t.amount;
    else if (t.type === "platform_fee") m.revenue += t.amount;
    else if (t.type === "applicant_payout" && t.to === PAYOUT_STATUS.sent_sandbox.label)
      m.payouts += t.amount;
  }
  const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return keys.map((k) => ({
    key: k,
    label: `${NAMES[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`,
    ...by.get(k)!,
  }));
}

/* ------------------------------------------------------------------ people */
export function applicantSummary(s: Snapshot, userId: string) {
  const bookings = s.rows.filter((r) => r.applicant.id === userId);
  const payouts = s.payoutRows.filter((p) => p.payout.userId === userId);
  const sent = payouts.filter((p) => p.payout.status === "sent_sandbox");
  const releasedNet = bookings.reduce(
    (n, r) => n + r.receipts.filter((x) => x.kind === "release").reduce((m, x) => m + x.amount - x.fee, 0),
    0,
  );
  const reserved = payouts.filter((p) => holdsBalance(p.payout)).reduce((n, p) => n + p.payout.amount, 0);
  return {
    bookings,
    payouts,
    active: bookings.filter((r) => r.status === "active" || r.status === "disputed").length,
    completed: bookings.filter((r) => r.status === "completed").length,
    earnings: bookings.reduce((n, r) => n + r.released, 0),
    received: sent.reduce((n, p) => n + p.net, 0),
    inEscrow: bookings.reduce((n, r) => n + r.held, 0),
    awaitingPayout: payouts
      .filter((p) => p.payout.status === "requested" || p.payout.status === "on_hold")
      .reduce((n, p) => n + p.payout.amount, 0),
    balance: Math.max(0, releasedNet - reserved),
  };
}

export function customerSummary(s: Snapshot, userId: string) {
  const bookings = s.rows.filter((r) => r.customer.id === userId);
  return {
    bookings,
    paid: bookings.reduce((n, r) => n + r.received, 0),
    inEscrow: bookings.reduce((n, r) => n + r.held, 0),
    refunded: bookings.reduce((n, r) => n + r.refunded, 0),
    postFees: s.posts.filter((p) => p.clientId === userId).reduce((n, p) => n + p.post.fee, 0),
    disputes: bookings.reduce((n, r) => n + r.disputes.length, 0),
  };
}

/* ------------------------------------------------------------------ complaints */
export interface Complaint {
  id: string;
  kind: "customer" | "applicant" | "payment" | "report";
  at: string;
  who: string;
  about: string;
  text: string;
  status: string;
  open: boolean;
  bookingId?: string;
  demo: boolean;
}

/** Disputes opened by either side, and safety reports, in one list. */
export function complaints(s: Snapshot): Complaint[] {
  const out: Complaint[] = [];
  for (const r of s.rows)
    for (const d of r.disputes) {
      const byCustomer = d.role === "client";
      out.push({
        id: d.id,
        kind: d.wanted === "refund" ? "payment" : byCustomer ? "customer" : "applicant",
        at: d.createdAt,
        who: byCustomer ? r.customer.name : r.applicant.name,
        about: `${r.ref} · ${r.title}`,
        text: d.reason,
        status: d.status.replace(/_/g, " "),
        open: d.status === "open",
        bookingId: r.id,
        demo: r.demo,
      });
    }
  for (const rep of s.reports as Report[]) {
    const reporter = s.userById.get(rep.reporterId);
    const target = rep.targetUserId ? s.userById.get(rep.targetUserId) : undefined;
    out.push({
      id: rep.id,
      kind: "report",
      at: rep.createdAt,
      who: reporter?.name ?? "—",
      about: target ? target.name : rep.targetTaskId ? "A post" : "—",
      text: `${rep.reason.replace(/_/g, " ")}${rep.details ? ` — ${rep.details}` : ""}`,
      status: rep.status,
      open: rep.status === "open" || rep.status === "reviewing",
      demo: reporter?.isDemo ?? false,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------------------------------------------------ search and filters */
export const matchesBooking = (r: BookingRow, q: string) => {
  const want = q.trim().toLowerCase();
  if (!want) return true;
  return [r.id, r.ref, r.title, r.customer.name, r.applicant.name, r.category].some((x) =>
    x.toLowerCase().includes(want),
  );
};

export function inDateRange(iso: string, from?: string, to?: string) {
  const day = nepalDay(new Date(iso));
  return (!from || day >= from) && (!to || day <= to);
}

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
