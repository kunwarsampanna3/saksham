import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { loadBooking } from "@/lib/booking-api";
import { store } from "@/lib/store";
import { createFamilyLink } from "@/lib/family";
import { config } from "@/lib/config";
import { withLock } from "@/lib/lock";

const Body = z.object({ action: z.literal("link") });

/** Client creates (or replaces) the private family-confirmation link. The token is shown once; only its hash is kept. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "family-link", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const { id } = await params;
  const made = await withLock(`booking:${id}`, async () => {
    const l = await loadBooking(id);
    if ("res" in l) return l;
    if (l.booking.clientId !== l.user.id) return { res: fail(403, "forbidden") };
    const task = await store.getTask(l.booking.taskId);
    if (!task?.forFamilyAbroad) return { res: fail(409, "not_abroad") };
    return { token: await createFamilyLink(l.booking, task.forFamilyAbroad.familyName || "Family") };
  });
  if ("res" in made) return made.res;
  const { token } = made;
  return NextResponse.json({ ok: true, url: `${config.appOrigin}/confirm/${token}` });
}
