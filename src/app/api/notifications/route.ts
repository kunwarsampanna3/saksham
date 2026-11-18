import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";
import { unreadMessages } from "@/lib/chat";

export const dynamic = "force-dynamic";

/** Bell + Messages badge: latest 15 notifications and unread counts. */
export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const all = (await store.listNotifications(user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({
    ok: true,
    unread: all.filter((n) => !n.readAt).length,
    messages: await unreadMessages(user),
    items: all.slice(0, 15).map((n) => ({ id: n.id, kind: n.kind, code: n.code, params: n.params, href: n.href, read: !!n.readAt, at: n.createdAt })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

const Body = z.object({ action: z.literal("read_all") });

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "notif", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const t = new Date().toISOString();
  for (const n of await store.listNotifications(user.id)) if (!n.readAt) await store.putNotification({ ...n, readAt: t });
  return NextResponse.json({ ok: true });
}
