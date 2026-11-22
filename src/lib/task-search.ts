import "server-only";
import { store, canSeeWomenOnly } from "@/lib/store";
import type { Task, User } from "@/lib/store/types";
import { category, type CategoryId } from "@/lib/pricing";
import { haversineKm } from "@/lib/geo";
import { ensureExampleTasks, sameWorld, taskCoords } from "@/lib/tasks";
import { matchesQuery, originFor, type Filters, type TaskResult } from "@/lib/search";
import { asOfNow } from "@/lib/post-state";

/** Open tasks the viewer may see, as cards. Women-only requests appear only to women providers (and their owner). */
export async function openTasksFor(viewer: User): Promise<TaskResult[]> {
  if (viewer.isDemo) await ensureExampleTasks();
  const women = canSeeWomenOnly(viewer);
  const now = Date.now();
  const demoCache = new Map<string, boolean>();
  const open = (await store.listTasks()).filter(
    (t) => asOfNow(t).status === "open" && (!t.womenOnly || women || t.clientId === viewer.id),
  );
  const seen = await Promise.all(open.map((t) => sameWorld(t, viewer, demoCache)));
  const owners = await Promise.all(open.map((t) => (t.clientId ? store.getUserById(t.clientId) : null)));
  const tasks = open.filter((_, i) => seen[i] && !owners[i]?.suspended);
  return Promise.all(
    tasks.map(async (t) =>
      toResult(
        t,
        (await store.listBids(t.id)).filter(
          (b) => b.status !== "withdrawn" && new Date(b.appearAt).getTime() <= now,
        ).length,
      ),
    ),
  );
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

/** Open IT jobs for a job seeker's feed (not their own tasks), with the details a job card needs. */
export async function jobFeed(
  viewer: User,
  cats: readonly string[],
): Promise<import("@/components/home/job-feed").Job[]> {
  const skills = new Set(viewer.categories ?? []);
  const open = (await openTasksFor(viewer)).filter((r) => cats.includes(r.category));
  const out = await Promise.all(
    open.map(async (r) => {
      const t = await store.getTask(r.id);
      if (!t || t.clientId === viewer.id) return null;
      const client = t.clientId ? await store.getUserById(t.clientId) : null;
      return {
        id: r.id,
        category: r.category,
        title: r.title,
        details: t.details,
        city: r.city,
        area: r.area,
        online: t.online,
        days: t.days,
        budget: t.budget,
        range: r.range,
        offers: r.offers,
        postedMinutesAgo: r.postedMinutesAgo,
        clientVerified: !!client?.verified,
        isExample: r.isExample,
        match: skills.has(r.category),
      };
    }),
  );
  return out.filter((x): x is NonNullable<typeof x> => x !== null);
}

export async function searchTasks(f: Filters, viewer: User): Promise<TaskResult[]> {
  const o = originFor(f.city);
  return (
    (await openTasksFor(viewer))
      .filter((t) => !f.women || t.womenOnly)
      .filter((t) => !f.cat || t.category === f.cat)
      .filter((t) => !f.online || t.city === "Online")
      .filter((t) => {
        const c = category(t.category);
        return matchesQuery(f.q, t.title.en, t.title.ne, c.en, c.ne, t.city, t.area ?? "");
      })
      .map((t) => ({
        ...t,
        distanceKm: t.coords && o ? Math.round(haversineKm(o, t.coords) * 10) / 10 : null,
      }))
      // Online work has no distance, so a radius never hides it.
      .filter((t) => !f.radius || t.distanceKm === null || t.distanceKm <= f.radius)
      .filter((t) => !f.max || t.range.low <= f.max)
      .sort((a, b) => {
        if (f.sort === "price") return a.range.low - b.range.low;
        if (f.sort === "near" || f.sort === "best") {
          const da = a.distanceKm ?? (o ? 30 : -1),
            db = b.distanceKm ?? (o ? 30 : -1);
          if (da !== db) return da - db;
        }
        return a.postedMinutesAgo - b.postedMinutesAgo;
      })
  );
}
