import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { loadTask, ruleResponse } from "@/lib/task-api";
import { requireFreshMpin } from "@/lib/booking-api";
import { createBooking } from "@/lib/escrow";

const Body = z.object({
  taskId: z.string().min(3).max(64),
  plan: z.enum(["full", "two", "milestones"]),
  method: z.enum(["esewa_sandbox", "khalti_sandbox"]),
});

/** Book the accepted offer: choose a plan and pay the first installment into escrow (sandbox). Needs a fresh MPIN. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "booking-create", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const stale = await requireFreshMpin();
  if (stale) return stale;
  const l = await loadTask(g.data.taskId);
  if ("res" in l) return l.res;
  try {
    const b = await createBooking(l.task, l.user, g.data.plan, g.data.method);
    return NextResponse.json({ ok: true, id: b.id });
  } catch (e) {
    return ruleResponse(e);
  }
}
