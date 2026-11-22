import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import type {
  Booking,
  Dispute,
  Installment,
  PayMethod,
  PlanKind,
  Receipt,
  Task,
  User,
} from "@/lib/store/types";
import { canMoveEscrow, splitPlan } from "@/lib/rules";
import { FEE_RATE } from "@/lib/pricing";
import { RuleError } from "@/lib/tasks";
import { notify, systemMessage } from "@/lib/chat";

/**
 * Escrow in plain code. Money states: scheduled → held → delivered → released (or refunded).
 * Payments are SANDBOX ONLY in this build (eSewa / Khalti "Sandbox · demo") — no real money moves.
 * The client pays the agreed price; Saksham's example 7% fee is withheld from the provider's payout on release.
 */
const now = () => new Date().toISOString();
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(d); // YYYY-MM-DD in Nepal
const addDays = (iso: string, n: number) =>
  ymd(new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86_400_000));

const LABELS: Record<PlanKind, Installment["label"][]> = {
  full: ["full"],
  two: ["first", "second"],
  milestones: ["start", "middle", "finish"],
};
const PCTS: Record<PlanKind, number[]> = { full: [100], two: [50, 50], milestones: [30, 40, 30] };

/** Installment amounts (always summing to the total) and due dates from the task timeline. */
export function planPreview(
  total: number,
  plan: PlanKind,
  task: Pick<Task, "days" | "dueDate">,
): Omit<Installment, "id" | "state">[] {
  const start = ymd(new Date());
  const end = task.dueDate && task.dueDate > start ? task.dueDate : addDays(start, Math.max(1, task.days));
  const span = Math.max(
    1,
    Math.round(
      (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86_400_000,
    ),
  );
  const dates =
    plan === "full"
      ? [start]
      : plan === "two"
        ? [start, end]
        : [start, addDays(start, Math.max(1, Math.floor(span / 2))), end];
  const amounts = splitPlan(total, plan);
  return amounts.map((amount, i) => ({
    seq: i + 1,
    label: LABELS[plan][i],
    pct: PCTS[plan][i],
    amount,
    dueDate: dates[i],
  }));
}

const receiptNo = () =>
  `SK-${ymd(new Date()).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
const sandboxRef = (m: PayMethod) =>
  `${m === "esewa_sandbox" ? "ESEWA" : m === "card_sandbox" ? "CARD" : "KHALTI"}-SBX-${randomBytes(5).toString("hex").toUpperCase()}`;

async function receipt(b: Booking, inst: Installment, kind: Receipt["kind"]): Promise<Receipt> {
  return store.putReceipt({
    id: randomUUID(),
    bookingId: b.id,
    installmentId: inst.id,
    kind,
    amount: inst.amount,
    fee: kind === "release" ? Math.round(inst.amount * b.feeRate) : 0,
    method: b.method,
    ref: sandboxRef(b.method),
    receiptNo: receiptNo(),
    createdAt: now(),
  });
}

export const roleIn = (b: Booking, u: User): "client" | "provider" | null =>
  b.clientId === u.id ? "client" : b.providerId === u.id ? "provider" : null;

/* ------------------------------------------------------------------ create */
export async function createBooking(
  task: Task,
  client: User,
  plan: PlanKind,
  method: PayMethod,
): Promise<Booking> {
  if (task.clientId !== client.id) throw new RuleError("forbidden", 403);
  if (await store.getBookingByTask(task.id)) throw new RuleError("already_booked");
  if (task.status !== "assigned" || !task.acceptedBidId || !task.agreedPrice)
    throw new RuleError("not_assigned");
  const bid = (await store.listBids(task.id)).find((b) => b.id === task.acceptedBidId);
  if (!bid) throw new RuleError("not_assigned");

  const installments: Installment[] = planPreview(task.agreedPrice, plan, task).map((p) => ({
    ...p,
    id: randomUUID(),
    state: "scheduled",
  }));
  // The first installment is paid into escrow now.
  installments[0] = { ...installments[0], state: "held", heldAt: now() };
  const b: Booking = {
    id: randomUUID(),
    taskId: task.id,
    bidId: bid.id,
    clientId: client.id,
    providerId: bid.providerId,
    providerName: bid.providerName,
    providerIsExample: bid.isExample,
    total: task.agreedPrice,
    feeRate: FEE_RATE,
    plan,
    method,
    status: "active",
    installments,
    createdAt: now(),
    updatedAt: now(),
  };
  await store.putBooking(b);
  await receipt(b, installments[0], "hold");
  await store.putTask({ ...task, status: "in_progress", updatedAt: now() });
  await event(b, "provider", "booked", { amount: installments[0].amount, total: b.total });
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

/** Client pays the next scheduled installment into escrow. Installments are paid in order. */
export async function payInstallment(b: Booking, user: User, id: string) {
  if (roleIn(b, user) !== "client") throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
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
  const role = roleIn(b, user);
  const demoProxy = config.demoMode && b.providerIsExample && role === "client";
  if (role !== "provider" && !demoProxy) throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  const i = inst(b, id);
  if (!canMoveEscrow(i.state, "delivered")) throw new RuleError("bad_state");
  const nb = await save(b, { ...i, state: "delivered", deliveredAt: now() });
  await event(nb, "client", "delivered", { amount: i.amount });
  return nb;
}

/** Client approves and releases a held/delivered installment to the provider (minus the example fee). */
export async function release(b: Booking, user: User, id: string) {
  if (roleIn(b, user) !== "client") throw new RuleError("forbidden", 403);
  if (b.status !== "active") throw new RuleError("booking_locked");
  const i = inst(b, id);
  if (i.state !== "held" && i.state !== "delivered") throw new RuleError("bad_state");
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
  const released = sum(["released"]);
  return {
    held: sum(["held", "delivered"]),
    released,
    refunded: sum(["refunded"]),
    scheduled: sum(["scheduled"]),
    feeOnReleased: Math.round(released * b.feeRate),
    providerNet: Math.round(b.total * (1 - b.feeRate)),
  };
}
