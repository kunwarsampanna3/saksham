import { NextResponse, type NextRequest } from "next/server";
import { store } from "@/lib/store";
import { loadTask } from "@/lib/task-api";
import { rankedOffers, isOwner } from "@/lib/tasks";

export const dynamic = "force-dynamic";

/**
 * Live state for the task page: ranked offers, Q&A and status. The page polls this every few seconds.
 * (With Supabase configured this can move to Realtime on bids/counters; polling works on any host.)
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await loadTask(id);
  if ("res" in l) return l.res;
  const { task, user } = l;
  const [offers, questions] = await Promise.all([rankedOffers(task, user), store.listQuestions(task.id)]);
  const owner = isOwner(task, user);
  return NextResponse.json(
    {
      ok: true,
      status: task.status,
      agreedPrice: task.agreedPrice ?? null,
      acceptedBidId: task.acceptedBidId ?? null,
      offers,
      // Q&A is public on the task; only the first name of the asker is shown.
      questions: questions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((q) => ({
        id: q.id, askerName: q.askerName, body: q.body, answer: q.answer ?? null, mine: q.askerId === user.id, createdAt: q.createdAt,
      })),
      owner,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
