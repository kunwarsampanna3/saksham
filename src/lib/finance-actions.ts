import "server-only";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import type { Booking, FinanceEvent, User } from "@/lib/store/types";
import { withLock } from "@/lib/lock";
import { RuleError } from "@/lib/tasks";
import { notify } from "@/lib/chat";
import { canSeePrivate, logAdmin } from "@/lib/admin";
import { isSuperAdmin } from "@/lib/superadmin";
import { resolveDispute, roleIn } from "@/lib/escrow";
import { getControls } from "@/lib/controls";
import { bookingRef, payoutRef } from "@/lib/finance";

/**
 * What the Super Admin can change from /superadmin. Each action:
 *  - checks the account on the server (the page hiding a button is never the only guard),
 *  - reads and writes inside the same lock the customer and applicant actions use, so nothing is done twice,
 *  - appends a FinanceEvent (never edited) and an audit log line.
 * None of them moves escrow money on its own: escrow is still released only by the milestone steps.
 */
const now = () => new Date().toISOString();

function need(admin: User) {
  if (!isSuperAdmin(admin)) throw new RuleError("not_found", 404);
}

/** The demo admin is one tap away on a demo site, so it may only touch demo accounts' money. */
function mayTouch(admin: User, u: Pick<User, "isDemo"> | null) {
  if (u && !canSeePrivate(admin, u)) throw new RuleError("protected", 403);
}

async function record(admin: User, e: Omit<FinanceEvent, "id" | "adminId" | "adminName" | "createdAt">) {
  const ev = await store.addFinanceEvent({
    ...e,
    id: randomUUID(),
    adminId: admin.id,
    adminName: admin.name,
    createdAt: now(),
  });
  await logAdmin(admin, `finance_${e.action}`, e.bookingId ?? e.payoutId ?? "", `${e.amount} · ${e.reason}`);
  return ev;
}

/* ------------------------------------------------------------------ withdrawals */
export type PayoutDecision = "approve" | "reject" | "hold";

export async function decidePayout(admin: User, payoutId: string, decision: PayoutDecision, reason: string) {
  need(admin);
  const first = await store.getPayout(payoutId);
  if (!first) throw new RuleError("not_found", 404);
  // The applicant's own withdrawal lock: a decision can't cross a new withdrawal or another decision.
  return withLock(`wallet:${first.userId}`, async () => {
    const p = await store.getPayout(payoutId);
    if (!p) throw new RuleError("not_found", 404);
    if (p.userId === admin.id) throw new RuleError("own_payout", 403);
    const owner = await store.getUserById(p.userId);
    mayTouch(admin, owner);
    if (p.status !== "requested" && p.status !== "on_hold") throw new RuleError("already_decided");
    if (decision === "hold" && p.status === "on_hold") throw new RuleError("already_on_hold");
    if (decision !== "approve" && reason.length < 3) throw new RuleError("reason", 422, { field: "reason" });

    const to = decision === "approve" ? "sent_sandbox" : decision === "reject" ? "rejected" : "on_hold";
    const updated = await store.putPayout({
      ...p,
      status: to,
      review: { at: now(), by: admin.id, byName: admin.name, reason },
    });
    await record(admin, {
      action:
        decision === "approve"
          ? "payout_approved"
          : decision === "reject"
            ? "payout_rejected"
            : "payout_held",
      payoutId: p.id,
      userId: p.userId,
      amount: p.amount,
      from: p.status,
      to,
      reason: reason || "Approved",
      ref: p.ref,
    });
    const net = p.amount - (p.fee ?? 0);
    if (decision === "approve") await notify(p.userId, "payment", "payout_sent", { amount: net }, "/wallet");
    else if (decision === "reject")
      await notify(p.userId, "payment", "payout_rejected", { amount: net, reason }, "/wallet");
    else await notify(p.userId, "payment", "payout_on_hold", { amount: net }, "/wallet");
    return { payout: updated, ref: payoutRef(p.id) };
  });
}

/* ------------------------------------------------------------------ booking holds */
export async function setBookingHold(admin: User, bookingId: string, hold: boolean, reason: string) {
  need(admin);
  // The same lock as /api/bookings/[id], so a hold and a customer's release can't overlap.
  return withLock(`booking:${bookingId}`, async () => {
    const b = await store.getBooking(bookingId);
    if (!b) throw new RuleError("not_found", 404);
    if (roleIn(b, admin)) throw new RuleError("own_booking", 403);
    mayTouch(admin, await store.getUserById(b.clientId));
    if (hold) {
      if (b.financeHold) throw new RuleError("already_on_hold");
      if (b.status !== "active" && b.status !== "disputed") throw new RuleError("booking_closed");
      if (reason.length < 3) throw new RuleError("reason", 422, { field: "reason" });
    } else if (!b.financeHold) throw new RuleError("not_on_hold");

    const held = b.installments.filter((i) => i.state === "held" || i.state === "delivered");
    const amount = held.reduce((n, i) => n + i.amount, 0);
    const next: Booking = {
      ...b,
      financeHold: hold ? { at: now(), by: admin.id, byName: admin.name, reason } : null,
      updatedAt: now(),
    };
    await store.putBooking(next);
    await record(admin, {
      action: hold ? "booking_held" : "booking_unheld",
      bookingId: b.id,
      amount,
      from: hold ? "Releasable" : "On hold",
      to: hold ? "On hold" : "Releasable",
      reason: reason || "Hold lifted",
    });
    const code = hold ? "booking_on_hold" : "booking_hold_lifted";
    const params = { booking: bookingRef(b.id) };
    await notify(b.clientId, "payment", code, params, `/payments/${b.id}`);
    if (!b.providerIsExample) await notify(b.providerId, "payment", code, params, `/payments/${b.id}`);
    return next;
  });
}

/* ------------------------------------------------------------------ disputes */
export async function teamResolveDispute(admin: User, bookingId: string, outcome: "redo" | "refund") {
  need(admin);
  return withLock(`booking:${bookingId}`, async () => {
    const b = await store.getBooking(bookingId);
    if (!b) throw new RuleError("not_found", 404);
    // The admin never judges a booking they are part of, demo or not.
    if (roleIn(b, admin)) throw new RuleError("own_booking", 403);
    mayTouch(admin, await store.getUserById(b.clientId));
    const refundable = b.installments
      .filter((i) => i.state === "held" || i.state === "delivered")
      .reduce((n, i) => n + i.amount, 0);
    const nb = await resolveDispute(b, admin, outcome);
    await record(admin, {
      action: outcome === "refund" ? "dispute_refund" : "dispute_redo",
      bookingId: b.id,
      amount: outcome === "refund" ? refundable : 0,
      from: "Disputed",
      to: outcome === "refund" ? "Refunded" : "Active (redo)",
      reason: outcome === "refund" ? "Held money refunded to the customer" : "Redo arranged",
    });
    return nb;
  });
}

/* ------------------------------------------------------------------ settings */
export async function setPayoutReview(admin: User, on: boolean) {
  need(admin);
  return withLock("controls", async () => {
    const before = await getControls();
    if ((before.payoutReview !== false) === on) return;
    await store.putControls({ ...before, payoutReview: on, updatedAt: now(), updatedBy: admin.id });
    await logAdmin(admin, "controls", "", `payoutReview=${on}`);
  });
}
