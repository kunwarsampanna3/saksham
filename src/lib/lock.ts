import "server-only";

/**
 * Runs `fn` alone for a key; other callers with the same key wait their turn.
 *
 * Every "read, check, then write" on money, offers, MPIN counters and verifications goes through here, and must
 * read inside the lock. Never hold a lock while reading a request body. Not re-entrant: don't take a key twice.
 * Protects one server process. With several instances, replace with database transactions or row locks.
 */
const g = globalThis as unknown as { __sakshamLocks?: Map<string, Promise<void>> };
const tails = (g.__sakshamLocks ??= new Map());

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const before = tails.get(key) ?? Promise.resolve();
  let done!: () => void;
  const mine = new Promise<void>((resolve) => (done = resolve));
  tails.set(key, mine);
  await before;
  try {
    return await fn();
  } finally {
    done();
    if (tails.get(key) === mine) tails.delete(key);
  }
}
