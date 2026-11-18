import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { loadBooking } from "@/lib/booking-api";
import { ruleResponse, cleanText } from "@/lib/task-api";
import { rateBooking } from "@/lib/wallet";

const Body = z.object({ stars: z.number().int().min(1).max(5), text: z.string().max(1000).default("") });

/** Client rates the provider once the job is complete. Real ratings feed the Earnings Passport and credit. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "rate", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const l = await loadBooking((await params).id);
  if ("res" in l) return l.res;
  try {
    const r = await rateBooking(l.user, l.booking, g.data.stars, cleanText(g.data.text, 1000));
    return NextResponse.json({ ok: true, id: r.id });
  } catch (e) {
    return ruleResponse(e);
  }
}
