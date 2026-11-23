import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fail, guard } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { requireFreshMpin } from "@/lib/booking-api";
import { cleanText, ruleResponse } from "@/lib/task-api";
import { config } from "@/lib/config";
import { isSuperAdmin } from "@/lib/superadmin";
import { decidePayout, setBookingHold, setPayoutReview, teamResolveDispute } from "@/lib/finance-actions";
import { seedFinanceDemo } from "@/lib/seed/finance-demo";

const id = z.string().uuid();
const reason = z.string().max(300);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("payout"), id, decision: z.enum(["approve", "reject", "hold"]), reason }),
  z.object({ action: z.literal("hold"), bookingId: id, hold: z.boolean(), reason }),
  z.object({ action: z.literal("dispute"), bookingId: id, outcome: z.enum(["redo", "refund"]) }),
  z.object({ action: z.literal("settings"), payoutReview: z.boolean() }),
  z.object({ action: z.literal("seed") }),
]);

/** Money actions need the MPIN within the last 5 minutes, like every payment in Saksham. */
const MONEY = new Set(["payout", "hold", "dispute"]);

/**
 * Super Admin dashboard actions. Anyone else gets 404, the same as a page that doesn't exist.
 * Each action checks the account again in finance-actions.ts.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "superadmin", schema: Body, limit: 60, evenWhenPaused: true });
  if ("res" in g) return g.res;
  const me = await currentUser();
  if (!isSuperAdmin(me)) return fail(404, "not_found");
  const d = g.data;
  if (MONEY.has(d.action)) {
    const stale = await requireFreshMpin();
    if (stale) return stale;
  }
  // On an open demo anyone can be the demo admin: they can try every money action, not switch site settings.
  if (config.publicDemo && me.isDemo && d.action === "settings") return fail(403, "public_demo");

  try {
    switch (d.action) {
      case "payout": {
        const r = await decidePayout(me, d.id, d.decision, cleanText(d.reason, 300));
        return NextResponse.json({ ok: true, status: r.payout.status, ref: r.ref });
      }
      case "hold": {
        const b = await setBookingHold(me, d.bookingId, d.hold, cleanText(d.reason, 300));
        return NextResponse.json({ ok: true, onHold: !!b.financeHold });
      }
      case "dispute": {
        const b = await teamResolveDispute(me, d.bookingId, d.outcome);
        return NextResponse.json({ ok: true, status: b.status });
      }
      case "settings":
        await setPayoutReview(me, d.payoutReview);
        return NextResponse.json({ ok: true });
      case "seed": {
        const n = await seedFinanceDemo();
        return NextResponse.json({ ok: true, bookings: n });
      }
    }
  } catch (e) {
    return ruleResponse(e);
  }
}
