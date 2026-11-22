import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { requireFreshMpin } from "@/lib/booking-api";
import { cleanText, ruleResponse } from "@/lib/task-api";
import { store } from "@/lib/store";
import { withLock } from "@/lib/lock";
import {
  applyToJob,
  canSeeJob,
  closeJob,
  declineApplication,
  hire,
  reopenJob,
  withdrawApplication,
} from "@/lib/abroad";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply"), note: z.string().max(500).default(""), eligible: z.boolean() }),
  z.object({ action: z.literal("withdraw") }),
  z.object({ action: z.literal("decline"), applicationId: z.string().uuid() }),
  // `amount` is the pay on the recruiter's screen. Strict, so a card number can never be sent along with it.
  z
    .object({
      action: z.literal("hire"),
      applicationId: z.string().uuid(),
      amount: z.number().int().positive(),
    })
    .strict(),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("reopen") }),
]);

/** apply / withdraw (applicant) · decline / hire by Visa with MPIN / close / reopen (recruiter). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { name: "abroad-action", schema: Body, limit: 30 });
  if ("res" in g) return g.res;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail(404, "not_found");
  if (g.data.action === "hire") {
    const stale = await requireFreshMpin();
    if (stale) return stale;
  }
  try {
    return await withLock(`abroad:${id}`, async () => {
      const user = await currentUser();
      if (!user) return fail(401, "signed_out");
      const job = await store.getAbroadJob(id);
      if (!job || !canSeeJob(job, user)) return fail(404, "not_found");
      const d = g.data;
      switch (d.action) {
        case "apply":
          await applyToJob(job, user, cleanText(d.note, 500), d.eligible);
          break;
        case "withdraw":
          await withdrawApplication(job, user);
          break;
        case "decline":
          await declineApplication(job, user, d.applicationId);
          break;
        case "close":
          await closeJob(job, user);
          break;
        case "reopen":
          await reopenJob(job, user);
          break;
        case "hire": {
          if (d.amount !== job.payPerWorker) return fail(409, "price_changed");
          const { booking } = await hire(job, user, d.applicationId);
          const paid = (await store.listReceipts(booking.id)).find((r) => r.kind === "hold");
          return NextResponse.json({ ok: true, bookingId: booking.id, ref: paid?.ref, receiptId: paid?.id });
        }
      }
      return NextResponse.json({ ok: true });
    });
  } catch (e) {
    return ruleResponse(e);
  }
}
