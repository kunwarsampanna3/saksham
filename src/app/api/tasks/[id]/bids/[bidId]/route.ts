import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { loadTask, ruleResponse } from "@/lib/task-api";
import { acceptBid, counterBid, respondCounter, withdrawBid } from "@/lib/tasks";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("counter"), amount: z.number().int().min(100).max(10_000_000) }),
  z.object({ action: z.literal("respond"), accept: z.boolean() }),
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("withdraw") }),
]);

/** Counter (client), respond to counter (provider), accept (client), withdraw (provider). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; bidId: string }> }) {
  const g = await guard(req, { name: "bid-action", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const { id, bidId } = await params;
  const l = await loadTask(id);
  if ("res" in l) return l.res;
  const { task, user } = l;
  try {
    switch (g.data.action) {
      case "counter": {
        const r = await counterBid(task, user, bidId, g.data.amount);
        return NextResponse.json({ ok: true, counter: r.bid.counter, auto: r.auto });
      }
      case "respond":
        await respondCounter(task, user, bidId, g.data.accept);
        return NextResponse.json({ ok: true });
      case "accept": {
        const t = await acceptBid(task, user, bidId);
        return NextResponse.json({ ok: true, agreedPrice: t.agreedPrice, next: `/booking/${t.id}` });
      }
      case "withdraw":
        await withdrawBid(task, user, bidId);
        return NextResponse.json({ ok: true });
    }
  } catch (e) {
    return ruleResponse(e);
  }
}
