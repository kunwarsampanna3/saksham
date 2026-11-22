import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { cleanText } from "@/lib/task-api";
import { CITY_COORDS } from "@/lib/geo";
import { coach, match } from "@/lib/ai/suggest";

const text = z.string().trim().min(4, "text").max(500, "text");
const lang = z.enum(["en", "ne"]).default("en");
const Body = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("match"),
    text,
    lang,
    city: z.string().refine((c) => c === "" || Object.hasOwn(CITY_COORDS, c), "city"),
    budget: z.number().int().min(1, "budget").max(1_000_000, "budget").nullable(),
  }),
  z.object({ mode: z.literal("coach"), text, lang }),
]);

/** AI match (teachers and professionals) and coach (what to learn, and from whom). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "ai-suggest", schema: Body, limit: 12 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const rl = rateLimit(`ai-suggest:${user.id}`, 30, 3600);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });

  const d = g.data;
  const need = cleanText(d.text, 500);
  const result =
    d.mode === "match"
      ? await match(user, { text: need, city: d.city, budget: d.budget }, d.lang)
      : await coach(user, need, d.lang);
  return NextResponse.json({ ok: true, mode: d.mode, ...result });
}
