import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { loadBooking } from "@/lib/booking-api";
import { store } from "@/lib/store";
import { createFamilyLink } from "@/lib/family";
import { config } from "@/lib/config";

const Body = z.object({ action: z.literal("link") });

/** Client creates (or replaces) the private family-confirmation link. The token is shown once; only its hash is kept. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "family-link", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const l = await loadBooking((await params).id);
  if ("res" in l) return l.res;
  if (l.booking.clientId !== l.user.id) return fail(403, "forbidden");
  const task = await store.getTask(l.booking.taskId);
  if (!task?.forFamilyAbroad) return fail(409, "not_abroad");
  const token = await createFamilyLink(l.booking, task.forFamilyAbroad.familyName || "Family");
  return NextResponse.json({ ok: true, url: `${config.appOrigin}/confirm/${token}` });
}
