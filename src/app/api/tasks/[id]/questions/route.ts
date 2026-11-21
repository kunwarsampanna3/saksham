import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { loadTask, ruleResponse, cleanText } from "@/lib/task-api";
import { ask, answer } from "@/lib/tasks";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ask"), body: z.string().min(2).max(500) }),
  z.object({ action: z.literal("answer"), questionId: z.string().uuid(), text: z.string().min(1).max(1000) }),
]);

/** Public Q&A on a task: anyone who can see the task asks; the client answers. Never share phone numbers here. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "task-qa", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const l = await loadTask((await params).id);
  if ("res" in l) return l.res;
  const text = g.data.action === "ask" ? g.data.body : g.data.text;
  // Keep contact details off the public board (escrow protects both sides only inside Saksham).
  const digits = text.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d))).replace(/[\s().-]/g, "");
  if (/9[78]\d{8}/.test(digits)) return fail(422, "no_contacts");
  try {
    const q =
      g.data.action === "ask"
        ? await ask(l.task, l.user, cleanText(text, 500))
        : await answer(l.task, l.user, g.data.questionId, cleanText(text, 1000));
    return NextResponse.json({ ok: true, id: q.id });
  } catch (e) {
    return ruleResponse(e);
  }
}
