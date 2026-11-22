import "server-only";
import { store } from "@/lib/store";
import type { Verification } from "@/lib/store/types";
import { withLock } from "@/lib/lock";

const EVERY_MS = 60 * 60 * 1000;

export const isExpired = (v: Pick<Verification, "purgeAfter">, at = Date.now()) =>
  !!v.purgeAfter && new Date(v.purgeAfter).getTime() < at;

/** Delete one person's document images whose 90 days are over. The decision stays. */
export async function purgeExpired(userId: string) {
  const due = (v: Verification) => v.files.length > 0 && isExpired(v);
  if (!(await store.listVerifications(userId)).some(due)) return;
  await withLock(`verify:${userId}`, async () => {
    for (const v of (await store.listVerifications(userId)).filter(due)) {
      for (const f of v.files) await store.deleteFile(f.path);
      await store.putVerification({ ...v, files: [] });
    }
  });
}

async function sweep() {
  const due = await store.listExpiredVerifications(new Date().toISOString());
  for (const userId of new Set(due.map((v) => v.userId))) {
    try {
      await purgeExpired(userId);
    } catch (e) {
      console.error("[saksham] Couldn't delete expired documents; will retry in an hour.", e);
    }
  }
}

/** Runs at server start and then hourly, so deletion doesn't wait for anyone to visit. */
export function startRetention() {
  const g = globalThis as { __sakshamRetention?: NodeJS.Timeout };
  if (g.__sakshamRetention) return;
  const run = () => void sweep().catch((e) => console.error("[saksham] Retention check failed.", e));
  g.__sakshamRetention = setInterval(run, EVERY_MS);
  g.__sakshamRetention.unref();
  run();
}
