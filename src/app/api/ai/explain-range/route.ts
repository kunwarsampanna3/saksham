import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/rate-limit";
import { loadTask } from "@/lib/task-api";
import { aiExplainRange } from "@/lib/ai/claude";
import { fairRangeLive } from "@/lib/prices";

const Body = z.object({ taskId: z.string().min(3).max(64), lang: z.enum(["en", "ne"]) });

/** Plain-language explanation of a task's fair range. Numbers come from the price table; AI only words them. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "ai-explain", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const l = await loadTask(g.data.taskId);
  if ("res" in l) return l.res;
  const rl = rateLimit(`ai-explain:${l.user.id}`, 40, 3600);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });
  const t = l.task;
  const r = await fairRangeLive({
    category: t.category,
    days: t.days,
    quantity: t.quantity,
    city: t.city,
    online: t.online,
  });
  const text = await aiExplainRange(
    { title: t.title, low: t.fairLow, high: t.fairHigh, basis: r.basis },
    g.data.lang,
  );
  return NextResponse.json({ ok: true, source: text ? "ai" : "fallback", text, basis: r.basis });
}
