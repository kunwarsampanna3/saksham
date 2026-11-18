import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { CATEGORY_IDS } from "@/lib/pricing";
import { CITY_COORDS, areasFor, ABROAD_COUNTRIES } from "@/lib/geo";
import { createTask } from "@/lib/tasks";
import { cleanText } from "@/lib/task-api";

const today = () => new Date().toISOString().slice(0, 10);

const Body = z.object({
  category: z.enum(CATEGORY_IDS),
  title: z.string().min(3, "title").max(80, "title"),
  details: z.string().max(2000, "details"),
  quantity: z.number().int().min(1).max(500),
  days: z.number().int().min(1).max(60),
  city: z.string().refine((c) => c === "Online" || c in CITY_COORDS, "city"),
  area: z.string().max(60).optional(),
  online: z.boolean(),
  womenOnly: z.boolean(),
  budget: z.number().int().min(100, "budget").max(1_000_000, "budget").nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  flexible: z.boolean(),
  family: z.object({ country: z.enum(ABROAD_COUNTRIES), familyName: z.string().max(60) }).optional(),
  aiSource: z.enum(["ai", "fallback", "manual"]),
});

/** Create a task. The fair range is recomputed here from the price table; anything sent by the browser is ignored. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "task-create", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const rl = rateLimit(`task-create:${user.id}`, 20, 3600);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });

  const d = g.data;
  if (d.dueDate && (d.dueDate < today() || d.dueDate > new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10))) {
    return fail(422, "due_date", { field: "dueDate" });
  }
  if (!d.online && d.city !== "Online" && d.area && !areasFor(d.city).some((a) => a.name === d.area)) {
    return fail(422, "area", { field: "area" });
  }
  const title = cleanText(d.title, 80);
  if (title.length < 3) return fail(422, "title", { field: "title" });

  const task = await createTask(user, {
    category: d.category, title, details: cleanText(d.details, 2000), quantity: d.quantity, days: d.days,
    city: d.city, area: d.area, online: d.online, womenOnly: d.womenOnly, budget: d.budget,
    dueDate: d.dueDate, flexible: d.flexible,
    forFamilyAbroad: d.family ? { country: d.family.country, familyName: cleanText(d.family.familyName, 60) } : undefined,
    aiSource: d.aiSource,
  });
  return NextResponse.json({ ok: true, id: task.id });
}
