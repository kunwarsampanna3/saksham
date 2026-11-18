import "server-only";
import { store, canSeeWomenOnly } from "@/lib/store";
import type { Task, User } from "@/lib/store/types";
import { category, type CategoryId } from "@/lib/pricing";
import { haversineKm } from "@/lib/geo";
import { ensureExampleTasks, sameWorld, taskCoords } from "@/lib/tasks";
import { matchesQuery, originFor, type Filters, type TaskResult } from "@/lib/search";

/** Open tasks the viewer may see, as cards. Women-only requests appear only to women providers (and their owner). */
export async function openTasksFor(viewer: User): Promise<TaskResult[]> {
  if (viewer.isDemo) await ensureExampleTasks();
  const women = canSeeWomenOnly(viewer);
  const now = Date.now();
  const demoCache = new Map<string, boolean>();
  const open = (await store.listTasks()).filter((t) => t.status === "open" && (!t.womenOnly || women || t.clientId === viewer.id));
  const seen = await Promise.all(open.map((t) => sameWorld(t, viewer, demoCache)));
  const tasks = open.filter((_, i) => seen[i]);
  return Promise.all(tasks.map(async (t) => toResult(t, (await store.listBids(t.id)).filter((b) => b.status !== "withdrawn" && new Date(b.appearAt).getTime() <= now).length)));
}

export function toResult(t: Task, offers: number): TaskResult {
  return {
    id: t.id,
    category: t.category as CategoryId,
    title: { en: t.title, ne: t.titleNe ?? t.title },
    city: t.city,
    area: t.area,
    womenOnly: t.womenOnly,
    forFamilyAbroad: t.forFamilyAbroad?.country,
    offers,
    postedMinutesAgo: Math.max(1, Math.round((Date.now() - new Date(t.createdAt).getTime()) / 60_000)),
    isExample: t.isExample,
    coords: taskCoords(t),
    distanceKm: null,
    range: { low: t.fairLow, high: t.fairHigh },
  };
}

export async function searchTasks(f: Filters, viewer: User): Promise<TaskResult[]> {
  const o = originFor(f.city);
  return (await openTasksFor(viewer))
    .filter((t) => !f.women || t.womenOnly)
    .filter((t) => !f.cat || t.category === f.cat)
    .filter((t) => !f.online || t.city === "Online")
    .filter((t) => {
      const c = category(t.category);
      return matchesQuery(f.q, t.title.en, t.title.ne, c.en, c.ne, t.city, t.area ?? "");
    })
    .map((t) => ({ ...t, distanceKm: t.coords && o ? Math.round(haversineKm(o, t.coords) * 10) / 10 : null }))
    // Online work has no distance, so a radius never hides it.
    .filter((t) => !f.radius || t.distanceKm === null || t.distanceKm <= f.radius)
    .filter((t) => !f.max || t.range.low <= f.max)
    .sort((a, b) => {
      if (f.sort === "price") return a.range.low - b.range.low;
      if (f.sort === "near" || f.sort === "best") {
        const da = a.distanceKm ?? (o ? 30 : -1), db = b.distanceKm ?? (o ? 30 : -1);
        if (da !== db) return da - db;
      }
      return a.postedMinutesAgo - b.postedMinutesAgo;
    });
}
