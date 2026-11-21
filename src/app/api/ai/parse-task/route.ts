import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { aiParseTask, keywordParseTask } from "@/lib/ai/claude";
import { fairRangeLive } from "@/lib/prices";

const Body = z.object({
  text: z.string().trim().min(4).max(1000),
  lang: z.enum(["en", "ne"]).default("en"),
  city: z.string().max(40).optional(),
});

/**
 * Sentence → {category, title, details, days}. AI first (8 s budget), keyword fallback otherwise.
 * The fair range is ALWAYS computed by plain code from the price table.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "ai-parse", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const s = await getSession();
  if (!s) return fail(401, "signed_out");
  const rl = rateLimit(`ai-parse-user:${s.sub}`, 30, 3600);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });

  const started = Date.now();
  const ai = await aiParseTask(g.data.text, g.data.lang);
  const task = ai ?? keywordParseTask(g.data.text);
  const range = await fairRangeLive({
    category: task.category,
    days: task.days,
    quantity: task.quantity,
    city: g.data.city,
    online: task.online,
  });

  return NextResponse.json({
    ok: true,
    source: ai ? "ai" : "fallback",
    ms: Date.now() - started,
    task,
    range,
  });
}
