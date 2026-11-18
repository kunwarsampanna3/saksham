import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { bookingForToken, confirmWork } from "@/lib/family";
import { cleanText } from "@/lib/task-api";

const Body = z.object({
  token: z.string().min(20).max(64),
  installmentId: z.string().uuid(),
  ok: z.boolean(),
  note: z.string().max(500).default(""),
});

/** Public (no sign-in): a family member confirms or flags delivered work via their private link. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "family-confirm", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const b = await bookingForToken(g.data.token);
  if (!b) return fail(404, "invalid");
  const r = await confirmWork(b, g.data.installmentId, g.data.ok, cleanText(g.data.note, 500));
  if (!r) return fail(409, "nothing_to_confirm");
  return NextResponse.json({ ok: true });
}
