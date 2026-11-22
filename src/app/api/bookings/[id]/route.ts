import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { ruleResponse } from "@/lib/task-api";
import { loadBooking, requireFreshMpin } from "@/lib/booking-api";
import { store } from "@/lib/store";
import { withLock } from "@/lib/lock";
import { markDelivered, payInstallment, paySecondHalf, release, reportHalfDone } from "@/lib/escrow";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("half") }),
  z.object({ action: z.literal("second") }),
  z.object({ action: z.literal("pay"), installmentId: z.string().uuid() }),
  z.object({ action: z.literal("deliver"), installmentId: z.string().uuid() }),
  z.object({ action: z.literal("release"), installmentId: z.string().uuid() }),
]);

/**
 * half (applicant: half is finished) · second (recruiter pays the second 50%, MPIN) ·
 * deliver (applicant: finished) · release (recruiter, MPIN) · pay (bookings from before, MPIN).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "booking-action", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const { id } = await params;
  try {
    // Load inside the lock, so a second click sees what the first one did.
    return await withLock(`booking:${id}`, async () => {
      const l = await loadBooking(id);
      if ("res" in l) return l.res;
      const d = g.data;
      if (d.action !== "deliver" && d.action !== "half") {
        const stale = await requireFreshMpin();
        if (stale) return stale;
      }
      const b =
        d.action === "half"
          ? await reportHalfDone(l.booking, l.user)
          : d.action === "second"
            ? await paySecondHalf(l.booking, l.user)
            : await { pay: payInstallment, deliver: markDelivered, release }[d.action](
                l.booking,
                l.user,
                d.installmentId,
              );
      const kind =
        d.action === "pay" || d.action === "second" ? "hold" : d.action === "release" ? "release" : null;
      const inst =
        d.action === "second"
          ? b.installments.find((i) => i.label === "half")?.id
          : "installmentId" in d
            ? d.installmentId
            : undefined;
      const rec = kind
        ? (await store.listReceipts(b.id)).filter((r) => r.kind === kind && r.installmentId === inst).at(-1)
        : undefined;
      return NextResponse.json({ ok: true, status: b.status, ref: rec?.ref, receiptId: rec?.id });
    });
  } catch (e) {
    return ruleResponse(e);
  }
}
