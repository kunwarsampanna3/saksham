import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { loadTask, ruleResponse, cleanText } from "@/lib/task-api";
import { placeBid } from "@/lib/tasks";
import { withLock } from "@/lib/lock";

const Body = z.object({
  amount: z.number().int().min(100, "amount_range").max(10_000_000, "amount_range"),
  days: z.number().int().min(1).max(90),
  message: z.string().max(1000),
});

/** Provider makes or updates an offer. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "bid", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const { id } = await params;
  try {
    return await withLock(`task:${id}`, async () => {
      const l = await loadTask(id);
      if ("res" in l) return l.res;
      const b = await placeBid(l.task, l.user, { ...g.data, message: cleanText(g.data.message, 1000) });
      return NextResponse.json({ ok: true, id: b.id });
    });
  } catch (e) {
    return ruleResponse(e);
  }
}
