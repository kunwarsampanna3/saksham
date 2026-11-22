import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { rateLimit } from "@/lib/auth/rate-limit";
import { loadTask } from "@/lib/task-api";
import { aiDraftProposal, templateProposal } from "@/lib/ai/claude";

const Body = z.object({
  taskId: z.string().min(3).max(64),
  amount: z.number().int().min(100).max(10_000_000),
  days: z.number().int().min(1).max(90),
  lang: z.enum(["en", "ne"]),
});

/** AI-drafted offer message for a provider (editable). Falls back to a template within the 8 s budget. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "ai-proposal", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const l = await loadTask(g.data.taskId);
  if ("res" in l) return l.res;
  if (!l.user.roles.includes("provider")) return fail(403, "provider_only");
  const rl = rateLimit(`ai-proposal:${l.user.id}`, 30, 3600);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });
  const ai = await aiDraftProposal(
    {
      taskTitle: l.task.title,
      taskDetails: l.task.details,
      amount: g.data.amount,
      days: g.data.days,
      providerName: l.user.name,
    },
    g.data.lang,
  );
  return NextResponse.json({
    ok: true,
    source: ai ? "ai" : "fallback",
    text: ai ?? templateProposal(g.data, g.data.lang),
  });
}
