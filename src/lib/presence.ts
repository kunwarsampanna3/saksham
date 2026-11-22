import "server-only";

/** Who is on the site now. In memory, for this one server process, and gone after a restart. */
const WINDOW_MS = 3 * 60_000;
const MAX = 50_000;

interface Seen {
  at: number;
  userId: string | null;
  page: string;
}
const g = globalThis as { __sakshamPresence?: Map<string, Seen> };
const seen = (g.__sakshamPresence ??= new Map());

function prune() {
  const before = Date.now() - WINDOW_MS;
  for (const [key, v] of seen) if (v.at < before) seen.delete(key);
}

export function markOnline(key: string, userId: string | null, page: string) {
  if (seen.size >= MAX) prune();
  if (seen.size < MAX) seen.set(key, { at: Date.now(), userId, page });
}

export function isOnline(key: string) {
  const v = seen.get(key);
  return !!v && v.at >= Date.now() - WINDOW_MS;
}

export function online() {
  prune();
  return [...seen.values()].sort((a, b) => b.at - a.at);
}

export const onlineCount = () => online().length;
