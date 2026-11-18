import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { store } from "@/lib/store";
import { loadConversation } from "@/lib/chat-api";
import { BlockedError, contactsAllowed, isBlocked, markRead, otherParty, sendMessage } from "@/lib/chat";
import { cleanText } from "@/lib/task-api";

export const dynamic = "force-dynamic";

/** Thread: messages oldest first. Opening it marks everything as read. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const l = await loadConversation((await params).cid);
  if ("res" in l) return l.res;
  const { user, conv } = l;
  await markRead(conv, user);
  const [msgs, other, task, allowed] = await Promise.all([
    store.listMessages(conv.id), store.getUserById(otherParty(conv, user)), conv.taskId ? store.getTask(conv.taskId) : null, contactsAllowed(conv),
  ]);
  const otherSeen = (m: { readBy: string[] }) => !!other && m.readBy.includes(other.id);
  return NextResponse.json({
    ok: true,
    other: { name: other?.name ?? "—", verified: !!other?.verified },
    task: task ? { id: task.id, title: task.title, status: task.status } : null,
    contactsAllowed: allowed,
    blocked: await isBlocked(conv.clientId, conv.providerId),
    messages: msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((m) => ({
      id: m.id, kind: m.kind, body: m.body, system: m.system ?? null, mine: m.senderId === user.id,
      file: m.file ? { url: `/api/messages/${conv.id}/file/${m.id}`, durationSec: m.file.durationSec ?? null } : null,
      seen: m.senderId === user.id ? otherSeen(m) : true, at: m.createdAt,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

const Body = z.object({ body: z.string().min(1).max(2000) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const g = await guard(req, { name: "chat-send", schema: Body, limit: 40 });
  if ("res" in g) return g.res;
  const l = await loadConversation((await params).cid);
  if ("res" in l) return l.res;
  const text = cleanText(g.data.body, 2000);
  if (!text) return NextResponse.json({ ok: false, error: "empty" }, { status: 422 });
  try {
    const r = await sendMessage(l.conv, l.user, { kind: "text", body: text });
    return NextResponse.json({ ok: true, id: r.message.id, masked: r.masked });
  } catch (e) {
    if (e instanceof BlockedError) return NextResponse.json({ ok: false, error: "blocked" }, { status: 403 });
    throw e;
  }
}
