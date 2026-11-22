import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { cleanText, ruleResponse } from "@/lib/task-api";
import { CATEGORY_IDS } from "@/lib/pricing";
import { JOB_COUNTRIES } from "@/lib/geo";
import { postJob } from "@/lib/abroad";

const Body = z.object({
  title: z.string().trim().min(3, "title").max(80, "title"),
  details: z.string().max(2000, "details").default(""),
  category: z.enum(CATEGORY_IDS, { message: "category" }),
  country: z.enum(JOB_COUNTRIES, { message: "country" }),
  city: z.string().trim().min(2, "city").max(60, "city"),
  workersNeeded: z.number().int().min(1, "workers").max(50, "workers"),
  days: z.number().int().min(1, "days").max(60, "days"),
  payPerWorker: z.number().int().min(1000, "pay").max(1_000_000, "pay"),
});

/** Post a job for Nepalis living abroad. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "abroad-post", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const rl = rateLimit(`abroad-post:${user.id}`, 20, 3600);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });
  const title = cleanText(g.data.title, 80);
  const city = cleanText(g.data.city, 60);
  if (title.length < 3) return fail(422, "title", { field: "title" });
  if (city.length < 2) return fail(422, "city", { field: "city" });
  try {
    const job = await postJob(user, { ...g.data, title, city, details: cleanText(g.data.details, 2000) });
    return NextResponse.json({ ok: true, id: job.id });
  } catch (e) {
    return ruleResponse(e);
  }
}
