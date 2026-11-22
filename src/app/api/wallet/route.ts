import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { requireFreshMpin } from "@/lib/booking-api";
import { ruleResponse, cleanText } from "@/lib/task-api";
import { applyForCredit, requestPayout } from "@/lib/wallet";

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("payout"),
    amount: z.number().int().min(1).max(10_000_000),
    method: z.enum(["esewa_sandbox", "khalti_sandbox"]),
  }),
  z.object({
    action: z.literal("credit"),
    amount: z.number().int().min(1).max(100_000),
    months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
    purpose: z.string().min(3, "purpose").max(300),
    example: z.boolean(),
  }),
]);

/** Withdraw earnings (sandbox, MPIN required) or apply for Saksham Credit (demo partner, MPIN required). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "wallet", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const stale = await requireFreshMpin();
  if (stale) return stale;
  try {
    if (g.data.action === "payout") {
      const p = await requestPayout(user, g.data.amount, g.data.method);
      return NextResponse.json({ ok: true, id: p.id, ref: p.ref });
    }
    const a = await applyForCredit(
      user,
      g.data.amount,
      g.data.months,
      cleanText(g.data.purpose, 300),
      g.data.example,
    );
    return NextResponse.json({ ok: true, id: a.id });
  } catch (e) {
    return ruleResponse(e);
  }
}
