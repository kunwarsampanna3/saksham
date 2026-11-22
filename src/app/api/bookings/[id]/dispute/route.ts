import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { ruleResponse, cleanText } from "@/lib/task-api";
import { loadBooking } from "@/lib/booking-api";
import { openDispute, resolveDispute } from "@/lib/escrow";
import { withLock } from "@/lib/lock";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("open"),
    reason: z.string().min(10, "reason").max(2000),
    wanted: z.enum(["redo", "refund"]),
  }),
  z.object({ action: z.literal("resolve"), outcome: z.enum(["redo", "refund"]) }),
]);

/** Service Guarantee: open a dispute (either party); resolve (admin, or the demo reviewer in DEMO_MODE). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "dispute", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const { id } = await params;
  try {
    return await withLock(`booking:${id}`, async () => {
      const l = await loadBooking(id);
      if ("res" in l) return l.res;
      if (g.data.action === "open") {
        const d = await openDispute(l.booking, l.user, cleanText(g.data.reason, 2000), g.data.wanted);
        return NextResponse.json({ ok: true, id: d.id });
      }
      const b = await resolveDispute(l.booking, l.user, g.data.outcome);
      return NextResponse.json({ ok: true, status: b.status });
    });
  } catch (e) {
    return ruleResponse(e);
  }
}
