import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { ruleResponse } from "@/lib/task-api";
import { loadBooking, requireFreshMpin } from "@/lib/booking-api";
import { store } from "@/lib/store";
import { markDelivered, payInstallment, release } from "@/lib/escrow";

const Body = z.object({
  action: z.enum(["pay", "deliver", "release"]),
  installmentId: z.string().uuid(),
});

/** pay (client, MPIN) · deliver (provider) · release (client, MPIN). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "booking-action", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const l = await loadBooking((await params).id);
  if ("res" in l) return l.res;
  if (g.data.action !== "deliver") {
    const stale = await requireFreshMpin();
    if (stale) return stale;
  }
  try {
    const fn = { pay: payInstallment, deliver: markDelivered, release }[g.data.action];
    const b = await fn(l.booking, l.user, g.data.installmentId);
    const rec = g.data.action === "pay" ? (await store.listReceipts(b.id)).filter((r) => r.kind === "hold" && r.installmentId === g.data.installmentId).at(-1) : undefined;
    return NextResponse.json({ ok: true, status: b.status, ref: rec?.ref, receiptId: rec?.id });
  } catch (e) {
    return ruleResponse(e);
  }
}
