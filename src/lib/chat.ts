import "server-only";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import type { Conversation, Message, NotificationKind, User } from "@/lib/store/types";

/**
 * Messaging + notifications.
 *  - A conversation is between a client and a real provider about one task (example providers can't chat).
 *  - System messages (offers, counters, payments) are stored as a code + params and rendered in the reader's language.
 *  - Phone numbers and emails are masked until the two have a booking, so deals and payments stay inside escrow.
 */
const now = () => new Date().toISOString();
const isReal = (id: string | null | undefined): id is string => !!id && !id.startsWith("ex:");

/** True when either user has blocked the other. Blocks stop chat and new offers between them. */
export async function isBlocked(a: string, b: string): Promise<boolean> {
  return (await store.listBlocks(a)).some((x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a));
}

export async function ensureConversation(clientId: string, providerId: string, taskId: string | null): Promise<Conversation> {
  const existing = await store.findConversation(clientId, providerId, taskId);
  if (existing) return existing;
  return store.putConversation({ id: randomUUID(), taskId, clientId, providerId, createdAt: now(), lastAt: now() });
}

/** Post a system message into the client↔provider conversation for a task (no-op for example providers). */
export async function systemMessage(clientId: string | null, providerId: string, taskId: string, code: string, params: Record<string, string | number> = {}) {
  if (!isReal(clientId) || !isReal(providerId)) return;
  const c = await ensureConversation(clientId, providerId, taskId);
  await store.putMessage({ id: randomUUID(), conversationId: c.id, senderId: null, kind: "system", body: code, system: { code, params }, readBy: [], createdAt: now() });
  await store.putConversation({ ...c, lastAt: now() });
}

export async function notify(userId: string | null | undefined, kind: NotificationKind, code: string, params: Record<string, string | number>, href: string) {
  if (!isReal(userId)) return;
  await store.putNotification({ id: randomUUID(), userId, kind, code, params, href, createdAt: now() });
}

/* ------------------------------------------------------------------ access */
export const isParty = (c: Conversation, u: User) => c.clientId === u.id || c.providerId === u.id;
export const otherParty = (c: Conversation, u: User) => (c.clientId === u.id ? c.providerId : c.clientId);

/** Contact details are allowed only once the two have a booking on this task. */
export async function contactsAllowed(c: Conversation): Promise<boolean> {
  if (!c.taskId) return false;
  const b = await store.getBookingByTask(c.taskId);
  return !!b && b.clientId === c.clientId && b.providerId === c.providerId && b.status !== "refunded";
}

const PHONE = /(?:\+?977[\s-]?)?(?:9[78](?:[\s-]?\d){8})/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
export function maskContacts(text: string): { text: string; masked: boolean } {
  const latin = text.replace(/[०-९]/g, (d) => String("०१२३४५६७८९".indexOf(d)));
  let masked = false;
  const out = latin.replace(PHONE, () => { masked = true; return "•••• ••••"; }).replace(EMAIL, () => { masked = true; return "••••@••••"; });
  // keep the original (Devanagari digits included) when nothing was masked
  return masked ? { text: out, masked } : { text, masked: false };
}

export class BlockedError extends Error {}

export async function sendMessage(c: Conversation, user: User, msg: Pick<Message, "kind" | "body" | "file">) {
  if (await isBlocked(c.clientId, c.providerId)) throw new BlockedError("blocked");
  const allowed = await contactsAllowed(c);
  const m = allowed || msg.kind !== "text" ? { text: msg.body, masked: false } : maskContacts(msg.body);
  const saved = await store.putMessage({
    id: randomUUID(), conversationId: c.id, senderId: user.id, kind: msg.kind, body: m.text, file: msg.file,
    readBy: [user.id], createdAt: now(),
  });
  await store.putConversation({ ...c, lastAt: now() });
  // One unread "new message" notification per conversation at a time.
  const to = otherParty(c, user);
  const pending = (await store.listNotifications(to)).some((n) => !n.readAt && n.kind === "message" && n.href === `/messages?c=${c.id}`);
  if (!pending) await notify(to, "message", "message_new", { from: user.name.split(" ")[0] }, `/messages?c=${c.id}`);
  return { message: saved, masked: m.masked };
}

export async function markRead(c: Conversation, user: User) {
  for (const m of await store.listMessages(c.id)) {
    if (!m.readBy.includes(user.id)) await store.putMessage({ ...m, readBy: [...m.readBy, user.id] });
  }
  for (const n of await store.listNotifications(user.id)) {
    if (!n.readAt && n.href === `/messages?c=${c.id}`) await store.putNotification({ ...n, readAt: now() });
  }
}

export async function unreadMessages(user: User): Promise<number> {
  let n = 0;
  for (const c of await store.listConversations(user.id)) {
    n += (await store.listMessages(c.id)).filter((m) => !m.readBy.includes(user.id)).length;
  }
  return n;
}
