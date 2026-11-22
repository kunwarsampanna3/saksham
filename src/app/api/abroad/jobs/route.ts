import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { cleanText, ruleResponse } from "@/lib/task-api";
import { CATEGORY_IDS } from "@/lib/pricing";
import { JOB_COUNTRIES } from "@/lib/geo";
import { postJob } from "@/lib/abroad";
import { requireFreshMpin } from "@/lib/booking-api";
import { switchedOff } from "@/lib/controls";
import { feeMatches, payForPost, PostChoice } from "@/lib/posting";
import { store } from "@/lib/store";
import { withLock } from "@/lib/lock";

const Body = z.object({
  title: z.string().trim().min(3, "title").max(80, "title"),
  details: z.string().max(2000, "details").default(""),
  category: z.enum(CATEGORY_IDS, { message: "category" }),
  country: z.enum(JOB_COUNTRIES, { message: "country" }),
  city: z.string().trim().min(2, "city").max(60, "city"),
  workersNeeded: z.number().int().min(1, "workers").max(50, "workers"),
  days: z.number().int().min(1, "days").max(60, "days"),
  payPerWorker: z.number().int().min(1000, "pay").max(1_000_000, "pay"),
  post: PostChoice,
});

/** Pay the posting fee (sandbox, MPIN) and post a job for Nepalis living abroad. */
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
  const { post, ...rest } = g.data;
  if (!feeMatches(post)) return fail(409, "price_changed");
  if (!user.roles.includes("client")) return fail(403, "client_only");
  const off = await switchedOff("posting", user);
  if (off) return off;
  const stale = await requireFreshMpin();
  if (stale) return stale;
  try {
    const job = await withLock(`post:${user.id}`, async () => {
      const same = (await store.listAbroadJobs()).find(
        (j) => j.clientId === user.id && j.post?.requestId === post.requestId,
      );
      const input = { ...rest, title, city, details: cleanText(rest.details, 2000) };
      return same ?? postJob(user, input, payForPost(post));
    });
    return NextResponse.json({ ok: true, id: job.id, ref: job.post?.ref });
  } catch (e) {
    return ruleResponse(e);
  }
}
