import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { loadTask, ruleResponse } from "@/lib/task-api";
import { requireFreshMpin } from "@/lib/booking-api";
import { store } from "@/lib/store";
import { createBooking } from "@/lib/escrow";
import { withLock } from "@/lib/lock";

const Body = z.object({
  taskId: z.string().min(3).max(64),

  method: z.enum(["esewa_sandbox", "khalti_sandbox", "card_sandbox"]),
});

/** Book the accepted offer by paying the 50% advance (sandbox). Needs a fresh MPIN. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "booking-create", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const stale = await requireFreshMpin();
  if (stale) return stale;
  try {
    return await withLock(`task:${g.data.taskId}`, async () => {
      const l = await loadTask(g.data.taskId);
      if ("res" in l) return l.res;
      const b = await createBooking(l.task, l.user, g.data.method);
      const hold = (await store.listReceipts(b.id)).filter((r) => r.kind === "hold").at(-1);
      return NextResponse.json({ ok: true, id: b.id, ref: hold?.ref, receiptId: hold?.id });
    });
  } catch (e) {
    return ruleResponse(e);
  }
}
