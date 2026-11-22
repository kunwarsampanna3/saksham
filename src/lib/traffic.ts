import "server-only";
import { createHash } from "node:crypto";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import type { TrafficDay } from "@/lib/store/types";
import { nepalDay, nepalHour } from "@/lib/nepal-time";
import { withLock } from "@/lib/lock";

/**
 * Visit counts for Admin → Traffic: pages, hours, how many different visitors. No IP addresses, no user agents,
 * and visitor ids only as a short one-way hash that changes every day.
 *
 * Counts build up in memory and are saved every 30 seconds, so a click doesn't rewrite the data file.
 */
const SAVE_AFTER_MS = 30_000;
const MAX_VISITORS = 20_000;
const MAX_PAGES = 100;

interface Pending {
  views: number;
  signedInViews: number;
  mobileViews: number;
  blocked: number;
  visitors: Set<string>;
  hours: number[];
  pages: Map<string, number>;
}
interface State {
  days: Map<string, Pending>;
  timer: NodeJS.Timeout | null;
}
const g = globalThis as { __sakshamTraffic?: State };
const state = (g.__sakshamTraffic ??= { days: new Map(), timer: null });

/** Ids become ":id", and anything unexpected becomes "other", so a visitor can't fill the list with junk. */
export function pageName(path: string) {
  const clean = path.split(/[?#]/)[0].slice(0, 120);
  const parts = clean.split("/").filter(Boolean);
  if (!parts.length) return "/";
  if (!/^[a-z-]{2,24}$/.test(parts[0])) return "other";
  const second = parts[1];
  if (!second) return `/${parts[0]}`;
  const fixed = ["new", "jobs"].includes(second);
  return `/${parts[0]}/${fixed ? second : ":id"}${fixed && parts[2] ? "/:id" : ""}`;
}

function today(): Pending {
  const day = nepalDay();
  let p = state.days.get(day);
  if (!p) {
    p = {
      views: 0,
      signedInViews: 0,
      mobileViews: 0,
      blocked: 0,
      visitors: new Set(),
      hours: Array<number>(24).fill(0),
      pages: new Map(),
    };
    state.days.set(day, p);
  }
  if (!state.timer) {
    state.timer = setTimeout(() => {
      state.timer = null;
      void flushTraffic().catch((e) => console.error("[saksham] Couldn't save visit counts.", e));
    }, SAVE_AFTER_MS);
    state.timer.unref();
  }
  return p;
}

export function countView(key: string, page: string, opts: { signedIn: boolean; mobile: boolean }) {
  const p = today();
  p.views++;
  if (opts.signedIn) p.signedInViews++;
  if (opts.mobile) p.mobileViews++;
  p.hours[nepalHour()]++;
  if (p.pages.has(page) || p.pages.size < MAX_PAGES) p.pages.set(page, (p.pages.get(page) ?? 0) + 1);
  if (p.visitors.size < MAX_VISITORS)
    p.visitors.add(
      createHash("sha256").update(`${nepalDay()}:${key}:${config.sessionSecret}`).digest("hex").slice(0, 12),
    );
}

export function countBlocked() {
  today().blocked++;
}

export async function flushTraffic() {
  await withLock("traffic", async () => {
    if (!state.days.size) return;
    const pending = state.days;
    state.days = new Map();
    const saved = new Map((await store.listTrafficDays()).map((d) => [d.day, d]));
    for (const [day, p] of pending) await store.putTrafficDay(merge(day, saved.get(day), p));
  });
}

function merge(day: string, old: TrafficDay | undefined, p: Pending): TrafficDay {
  const pages = { ...old?.pages };
  for (const [page, n] of p.pages)
    if (page in pages || Object.keys(pages).length < MAX_PAGES) pages[page] = (pages[page] ?? 0) + n;
  return {
    day,
    views: (old?.views ?? 0) + p.views,
    signedInViews: (old?.signedInViews ?? 0) + p.signedInViews,
    mobileViews: (old?.mobileViews ?? 0) + p.mobileViews,
    blocked: (old?.blocked ?? 0) + p.blocked,
    visitors: [...new Set([...(old?.visitors ?? []), ...p.visitors])].slice(0, MAX_VISITORS),
    hours: p.hours.map((n, i) => n + (old?.hours[i] ?? 0)),
    pages,
  };
}

/** The last `days` days, oldest first, with empty days filled in. */
export async function trafficHistory(days: number): Promise<TrafficDay[]> {
  await flushTraffic();
  const saved = new Map((await store.listTrafficDays()).map((d) => [d.day, d]));
  return Array.from({ length: days }, (_, i) => {
    const day = nepalDay(new Date(Date.now() - (days - 1 - i) * 86_400_000));
    return (
      saved.get(day) ?? {
        day,
        views: 0,
        signedInViews: 0,
        mobileViews: 0,
        blocked: 0,
        visitors: [],
        hours: Array<number>(24).fill(0),
        pages: {},
      }
    );
  });
}
