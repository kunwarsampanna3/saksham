import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { mpinProblem, mpinSchema } from "@/lib/validation";
import { store, toPublicUser } from "@/lib/store";
import { hashMpin } from "@/lib/auth/mpin";
import { clearVerifiedTicket, readVerifiedTicket } from "@/lib/auth/otp";
import { nowSec, setSessionCookie } from "@/lib/auth/session";
import { userByTarget } from "@/lib/auth/target";

const Body = z.object({ mpin: mpinSchema });

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "reset-mpin", schema: Body, limit: 5, windowSec: 60 });
  if ("res" in g) return g.res;

  const target = await readVerifiedTicket("reset");
  if (!target) return fail(401, "otp_required");
  if (mpinProblem(g.data.mpin) === "weak") return fail(422, "mpin_weak", { field: "mpin" });

  const user = await userByTarget(target);
  if (!user) return fail(401, "otp_required");

  // A verified OTP also clears any lockout. Passkeys stay — they are device-bound.
  const updated = await store.updateUser(user.id, {
    mpinHash: await hashMpin(g.data.mpin),
    failedAttempts: 0,
    lockedUntil: null,
  });
  await clearVerifiedTicket();
  await setSessionCookie({ sub: updated.id, role: updated.activeRole, mpinAt: nowSec() });
  return NextResponse.json({ ok: true, user: toPublicUser(updated) });
}
