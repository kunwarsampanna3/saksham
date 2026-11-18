import "server-only";
import { store } from "@/lib/store";
import type { User } from "@/lib/store/types";

/** People this user has dealt with (chats, bookings, offers on their tasks) — the only people they can report or block. */
export async function counterparts(user: User): Promise<{ id: string; name: string }[]> {
  const ids = new Set<string>();
  for (const c of await store.listConversations(user.id)) ids.add(c.clientId === user.id ? c.providerId : c.clientId);
  for (const b of await store.listBookings()) {
    if (b.clientId === user.id && !b.providerIsExample) ids.add(b.providerId);
    if (b.providerId === user.id) ids.add(b.clientId);
  }
  for (const t of await store.listTasks()) {
    if (t.clientId !== user.id) continue;
    for (const b of await store.listBids(t.id)) if (!b.isExample) ids.add(b.providerId);
  }
  for (const bl of await store.listBlocks(user.id)) if (bl.blockerId === user.id) ids.add(bl.blockedId);
  ids.delete(user.id);
  const out: { id: string; name: string }[] = [];
  for (const id of ids) { const u = await store.getUserById(id); if (u) out.push({ id, name: u.name }); }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
