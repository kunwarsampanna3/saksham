import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { mpinProblem, mpinSchema } from "@/lib/validation";
import { store, toPublicUser } from "@/lib/store";
import { hashMpin } from "@/lib/auth/mpin";
import { clearVerifiedTicket, readVerifiedTicket } from "@/lib/auth/otp";
import { startSession } from "@/lib/auth/session";
import { withLock } from "@/lib/lock";
import { userByTarget } from "@/lib/auth/target";

const Body = z.object({ mpin: mpinSchema });

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "reset-mpin", schema: Body, limit: 5, windowSec: 60 });
  if ("res" in g) return g.res;

  const ticket = await readVerifiedTicket("reset");
  if (!ticket) return fail(401, "otp_required");
  if (mpinProblem(g.data.mpin) === "weak") return fail(422, "mpin_weak", { field: "mpin" });

  const user = await userByTarget(ticket.target);
  if (!user) return fail(401, "otp_required");

  const updated = await withLock(`mpin:${user.id}`, async () => {
    const fresh = await store.getUserById(user.id);
    const ver = fresh?.sessionVersion ?? 0;
    if (!fresh || ver !== ticket.ver) return null; // this permission was already used
    // Ends every session and any other reset ticket. A verified OTP also clears any lockout.
    // Passkeys stay — they are device-bound.
    return store.updateUser(fresh.id, {
      mpinHash: await hashMpin(g.data.mpin),
      failedAttempts: 0,
      lockedUntil: null,
      sessionVersion: ver + 1,
      revokedSessions: [],
    });
  });
  if (!updated) return fail(401, "otp_required");
  await clearVerifiedTicket();
  if (updated.suspended) return fail(403, "suspended");
  await startSession(updated);
  return NextResponse.json({ ok: true, user: toPublicUser(updated) });
}
