import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";
import { ensureConversation, otherParty } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** Conversation list with the other person, the task, the last message and unread count. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const convs = (await store.listConversations(user.id)).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const items = await Promise.all(
    convs.map(async (c) => {
      const [other, task, msgs] = await Promise.all([
        store.getUserById(otherParty(c, user)),
        c.taskId ? store.getTask(c.taskId) : null,
        store.listMessages(c.id),
      ]);
      const last = msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
      return {
        id: c.id,
        other: { name: other?.name ?? "—", verified: !!other?.verified },
        role: c.clientId === user.id ? "client" : "provider",
        task: task ? { id: task.id, title: task.title } : null,
        last: last
          ? {
              kind: last.kind,
              body: last.kind === "text" ? last.body.slice(0, 80) : "",
              system: last.system ?? null,
              mine: last.senderId === user.id,
              at: last.createdAt,
            }
          : null,
        unread: msgs.filter((m) => !m.readBy.includes(user.id)).length,
        lastAt: c.lastAt,
      };
    }),
  );
  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "private, no-store" } });
}

const Start = z.object({ taskId: z.string().min(3).max(64), withUserId: z.string().uuid().optional() });

/**
 * Start (or reopen) the conversation for a task.
 *  - Client: with a provider who has an offer on the task.
 *  - Provider: with the task's client, once they have made an offer.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "chat-start", schema: Start, limit: 30 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const task = await store.getTask(g.data.taskId);
  if (!task || !task.clientId) return fail(404, "not_found");
  const bids = (await store.listBids(task.id)).filter((b) => !b.isExample && b.status !== "withdrawn");
  let clientId: string, providerId: string;
  if (task.clientId === user.id) {
    if (!g.data.withUserId || !bids.some((b) => b.providerId === g.data.withUserId))
      return fail(403, "no_offer");
    clientId = user.id;
    providerId = g.data.withUserId;
  } else {
    if (!bids.some((b) => b.providerId === user.id)) return fail(403, "offer_first");
    clientId = task.clientId;
    providerId = user.id;
  }
  const c = await ensureConversation(clientId, providerId, task.id);
  return NextResponse.json({ ok: true, id: c.id });
}
