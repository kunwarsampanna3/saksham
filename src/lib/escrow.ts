import "server-only";
import { randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import type { Booking, Dispute, Installment, PayMethod, Receipt, Task, User } from "@/lib/store/types";
import { canMoveEscrow } from "@/lib/rules";
import { netOfFee, splitAdvance } from "@/lib/business";
import { receiptNo, sandboxRef } from "@/lib/payments";
import { RuleError } from "@/lib/tasks";
import { notify, systemMessage } from "@/lib/chat";
import { nepalDay } from "@/lib/nepal-time";

/**
 * Escrow in plain code. Payments are SANDBOX ONLY in this build: no real money moves.
 *
 * New bookings ("advance", see business.ts for the numbers):
 *   createBooking ....... recruiter pays 50% · applicant is paid 30% · 20% is held
 *   reportHalfDone ...... applicant says half is finished (notification + chat message)
 *   paySecondHalf ....... recruiter pays 50% · applicant is paid 30% · 40% is held
 *   markDelivered ....... applicant says it's finished
 *   release ............. recruiter approves · applicant is paid 40%
 *
 * Bookings from before (full, two, milestones) keep their own schedule: payInstallment → markDelivered → release,
 * with their 7% taken at each release.
 */
const now = () => new Date().toISOString();
const addDays = (day: string, n: number) =>
  nepalDay(new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000));

/** When each step is expected, from the task's timeline. */
export function advanceDates(task: Pick<Task, "days" | "dueDate">) {
  const start = nepalDay(new Date());
  const end = task.dueDate && task.dueDate > start ? task.dueDate : addDays(start, Math.max(1, task.days));
  const span = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  return { start, half: addDays(start, Math.max(1, Math.floor(span / 2))), end };
}

async function receipt(
  b: Booking,
  inst: Installment,
  kind: Receipt["kind"],
  amount = inst.amount,
): Promise<Receipt> {
  return store.putReceipt({
    id: randomUUID(),
    bookingId: b.id,
    installmentId: inst.id,
    kind,
    amount,
    fee: kind === "release" ? Math.round(amount * b.feeRate) : 0,
    method: b.method,
    ref: sandboxRef(b.method),
    receiptNo: receiptNo(),
    createdAt: now(),
  });
}

export const roleIn = (b: Booking, u: User): "client" | "provider" | null =>
  b.clientId === u.id ? "client" : b.providerId === u.id ? "provider" : null;

/* ------------------------------------------------------------------ create */
export async function createBooking(task: Task, client: User, method: PayMethod): Promise<Booking> {
  if (task.clientId !== client.id) throw new RuleError("forbidden", 403);
  if (await store.getBookingByTask(task.id)) throw new RuleError("already_booked");
  if (task.status !== "assigned" || !task.acceptedBidId || !task.agreedPrice)
    throw new RuleError("not_assigned");
  const bid = (await store.listBids(task.id)).find((b) => b.id === task.acceptedBidId);
  if (!bid) throw new RuleError("not_assigned");

  const total = task.agreedPrice;
  const { firstPayment, pieces } = splitAdvance(total);
  const dates = advanceDates(task);
  const at = now();
  const piece = (
    seq: number,
    label: "advance" | "kept" | "half" | "finish",
    pct: number,
    dueDate: string,
    rest: Pick<Installment, "state" | "heldAt" | "releasedAt">,
  ): Installment => ({ id: randomUUID(), seq, label, pct, amount: pieces[label], dueDate, ...rest });
  const installments = [
    piece(1, "advance", 30, dates.start, { state: "released", heldAt: at, releasedAt: at }),
    piece(2, "kept", 20, dates.half, { state: "held", heldAt: at }),
    piece(3, "half", 10, dates.half, { state: "scheduled" }),
    piece(4, "finish", 40, dates.end, { state: "scheduled" }),
  ];
  const b: Booking = {
    id: randomUUID(),
    taskId: task.id,
    bidId: bid.id,
    clientId: client.id,
    providerId: bid.providerId,
    providerName: bid.providerName,
    providerIsExample: bid.isExample,
    total,
    feeRate: 0,
    plan: "advance",
    method,
    status: "active",
    installments,
    createdAt: at,
    updatedAt: at,
  };
  await store.putBooking(b);
  await receipt(b, installments[0], "hold", firstPayment);
  await receipt(b, installments[0], "release");
  await store.putTask({ ...task, status: "in_progress", updatedAt: at });
  await event(b, "provider", "advance_paid", {
    amount: firstPayment,
    paid: pieces.advance,
    kept: pieces.kept,
  });
  return b;
}

/* ------------------------------------------------------------------ transitions */
function inst(b: Booking, id: string) {
  const i = b.installments.find((x) => x.id === id);
  if (!i) throw new RuleError("not_found", 404);
  return i;
}
async function save(b: Booking, changed: Installment): Promise<Booking> {
  const updated = {
    ...b,
    installments: b.installments.map((x) => (x.id === changed.id ? changed : x)),
    updatedAt: now(),
  };
  return store.putBooking(updated);
}

/** The applicant, or in DEMO_MODE the recruiter standing in for an example applicant, who can't act. */
function canActAsProvider(b: Booking, user: User) {
  const role = roleIn(b, user);
  return role === "provider" || (config.demoMode && b.providerIsExample && role === "client");
}

/** The applicant says half of the work is finished. It moves no money: it asks for the second 50%. */
export async function reportHalfDone(b: Booking, user: User) {
  if (!canActAsProvider(b, user)) throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  if (b.plan !== "advance" || b.halfDoneAt) throw new RuleError("bad_state");
  const nb = await store.putBooking({ ...b, halfDoneAt: now(), updatedAt: now() });
  await event(nb, "client", "half_done", { amount: splitAdvance(b.total).secondPayment });
  return nb;
}

/** The recruiter pays the second 50%. The applicant is paid their second 30% and the last 40% is held. */
export async function paySecondHalf(b: Booking, user: User) {
  if (roleIn(b, user) !== "client") throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  if (b.plan !== "advance") throw new RuleError("bad_state");
  if (!b.halfDoneAt) throw new RuleError("half_not_reported");
  const finish = b.installments.find((i) => i.label === "finish")!;
  if (finish.state !== "scheduled") throw new RuleError("bad_state");

  const at = now();
  const nb = await store.putBooking({
    ...b,
    updatedAt: at,
    installments: b.installments.map((i) =>
      i.label === "kept" || i.label === "half"
        ? { ...i, state: "released", heldAt: i.heldAt ?? at, releasedAt: at }
        : i.label === "finish"
          ? { ...i, state: "held", heldAt: at }
          : i,
    ),
  });
  const { secondPayment, payouts } = splitAdvance(b.total);
  const half = nb.installments.find((i) => i.label === "half")!;
  await receipt(nb, half, "hold", secondPayment);
  await receipt(nb, half, "release", payouts.half);
  await event(nb, "provider", "second_paid", {
    amount: secondPayment,
    paid: payouts.half,
    last: payouts.finish,
  });
  return nb;
}

/** Bookings from before: the client pays the next scheduled installment. Installments are paid in order. */
export async function payInstallment(b: Booking, user: User, id: string) {
  if (roleIn(b, user) !== "client") throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  if (b.plan === "advance") throw new RuleError("bad_state");
  const i = inst(b, id);
  const next = b.installments.find((x) => x.state === "scheduled");
  if (!next || next.id !== i.id) throw new RuleError("out_of_order");
  if (!canMoveEscrow(i.state, "held")) throw new RuleError("bad_state");
  const changed = { ...i, state: "held" as const, heldAt: now() };
  const nb = await save(b, changed);
  await receipt(nb, changed, "hold");
  await event(nb, "provider", "paid", { amount: changed.amount });
  return nb;
}

/**
 * Provider marks the work for an installment as delivered.
 * Example providers can't act, so in DEMO_MODE the client may mark it for them (labelled in the UI).
 */
export async function markDelivered(b: Booking, user: User, id: string) {
  if (!canActAsProvider(b, user)) throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  const i = inst(b, id);
  if (!isApprovable(b, i)) throw new RuleError("bad_state");
  if (!canMoveEscrow(i.state, "delivered")) throw new RuleError("bad_state");
  const nb = await save(b, { ...i, state: "delivered", deliveredAt: now() });
  await event(nb, "client", "delivered", { amount: i.amount });
  return nb;
}

/** Client approves and releases. On "advance" bookings only the last 40% is released this way. */
export async function release(b: Booking, user: User, id: string) {
  if (roleIn(b, user) !== "client") throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  const i = inst(b, id);
  if (!isApprovable(b, i) || (i.state !== "held" && i.state !== "delivered"))
    throw new RuleError("bad_state");
  const changed = { ...i, state: "released" as const, releasedAt: now() };
  let nb = await save(b, changed);
  await receipt(nb, changed, "release");
  await event(nb, "provider", "released", {
    amount: changed.amount,
    net: changed.amount - Math.round(changed.amount * nb.feeRate),
  });
  if (nb.installments.every((x) => x.state === "released")) {
    nb = await store.putBooking({ ...nb, status: "completed", updatedAt: now() });
    const task = await store.getTask(nb.taskId);
    if (task) await store.putTask({ ...task, status: "completed", updatedAt: now() });
  }
  return nb;
}

/** On "advance" bookings the kept 20% leaves with the second payment, never on its own. */
export const isApprovable = (b: Booking, i: Installment) => b.plan !== "advance" || i.label === "finish";

/** What the applicant ends up with from this booking, after the 7%. */
export const providerNet = (b: Booking) => netOfFee(b.total);

/* ------------------------------------------------------------------ Service Guarantee */
export async function openDispute(b: Booking, user: User, reason: string, wanted: Dispute["wanted"]) {
  const role = roleIn(b, user);
  if (!role) throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  const d = await store.putDispute({
    id: randomUUID(),
    bookingId: b.id,
    openedBy: user.id,
    role,
    reason,
    wanted,
    status: "open",
    createdAt: now(),
  });
  await store.putBooking({ ...b, status: "disputed", updatedAt: now() });
  const task = await store.getTask(b.taskId);
  if (task) await store.putTask({ ...task, status: "disputed", updatedAt: now() });
  await event(b, role === "client" ? "provider" : "client", "dispute_opened", {});
  return d;
}

/** Notify one side and post a system message in their conversation. */
async function event(
  b: Booking,
  to: "client" | "provider",
  code: string,
  params: Record<string, string | number>,
) {
  const task = await store.getTask(b.taskId);
  const p = { ...params, task: task?.title ?? "" };
  await notify(to === "client" ? b.clientId : b.providerId, "payment", code, p, `/payments/${b.id}`);
  await systemMessage(b.clientId, b.providerId, b.taskId, code, params);
}

/**
 * Resolve a dispute. An admin who isn't a party; in DEMO_MODE a demo account that is a party may resolve as the
 * "demo reviewer" (labelled). Real accounts never resolve their own.
 *  - redo: work continues, money stays where it is.
 *  - refund: everything still in escrow (held/delivered) goes back to the client; released money is not clawed back.
 */
export async function resolveDispute(b: Booking, user: User, outcome: "redo" | "refund") {
  const party = roleIn(b, user) !== null;
  // Nobody judges their own dispute, except demo accounts playing the "demo reviewer".
  const allowed = party ? config.demoMode && user.isDemo : user.isAdmin;
  if (!allowed) throw new RuleError("forbidden", 403);
  if (b.status !== "disputed") throw new RuleError("no_dispute");
  const open = (await store.listDisputes(b.id)).filter((x) => x.status === "open");
  if (!open.length) throw new RuleError("no_dispute");
  const task = await store.getTask(b.taskId);
  if (outcome === "redo") {
    for (const d of open)
      await store.putDispute({
        ...d,
        status: "redo_arranged",
        resolution: party ? "Redo arranged (demo reviewer)" : "Redo arranged by Saksham",
        resolvedAt: now(),
      });
    const nb = await store.putBooking({ ...b, status: "active", updatedAt: now() });
    if (task) await store.putTask({ ...task, status: "in_progress", updatedAt: now() });
    await event(nb, "client", "dispute_redo", {});
    await notify(nb.providerId, "payment", "dispute_redo", { task: task?.title ?? "" }, `/payments/${nb.id}`);
    return nb;
  }
  let nb = b;
  for (const i of b.installments) {
    if (i.state === "held" || i.state === "delivered") {
      const changed = { ...i, state: "refunded" as const, refundedAt: now() };
      nb = { ...nb, installments: nb.installments.map((x) => (x.id === i.id ? changed : x)) };
      await receipt(nb, changed, "refund");
    }
    // Unpaid (scheduled) installments stay "scheduled" and are shown as cancelled once the booking is refunded.
  }
  nb = await store.putBooking({ ...nb, status: "refunded", updatedAt: now() });
  for (const d of open)
    await store.putDispute({
      ...d,
      status: "refunded",
      resolution: party ? "Refunded (demo reviewer)" : "Refunded by Saksham",
      resolvedAt: now(),
    });
  if (task) await store.putTask({ ...task, status: "cancelled", updatedAt: now() });
  await event(nb, "client", "dispute_refund", {});
  await notify(nb.providerId, "payment", "dispute_refund", { task: task?.title ?? "" }, `/payments/${nb.id}`);
  return nb;
}

/** Totals for the schedule header. */
export function totals(b: Booking) {
  const sum = (s: Installment["state"][]) =>
    b.installments.filter((i) => s.includes(i.state)).reduce((a, i) => a + i.amount, 0);
  return {
    held: sum(["held", "delivered"]),
    released: sum(["released"]),
    refunded: sum(["refunded"]),
    scheduled: sum(["scheduled"]),
    providerNet: providerNet(b),
  };
}
