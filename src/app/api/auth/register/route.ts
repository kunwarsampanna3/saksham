import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { citySchema, langSchema, mpinProblem, mpinSchema, nameSchema, roleChoiceSchema } from "@/lib/validation";
import { store, toPublicUser } from "@/lib/store";
import { hashMpin } from "@/lib/auth/mpin";
import { clearVerifiedTicket, readVerifiedTicket } from "@/lib/auth/otp";
import { nowSec, setSessionCookie } from "@/lib/auth/session";
import type { Role } from "@/lib/store/types";
import { isEmail } from "@/lib/auth/target";

const Body = z.object({
  name: nameSchema,
  city: citySchema,
  role: roleChoiceSchema,
  mpin: mpinSchema,
  lang: langSchema.default("en"),
});

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "register", schema: Body, limit: 5, windowSec: 60 });
  if ("res" in g) return g.res;
  const { name, city, role, mpin, lang } = g.data;

  // The verified phone or email comes from the OTP ticket cookie, never from the request body.
  const target = await readVerifiedTicket("signup");
  if (!target) return fail(401, "otp_required");
  const viaEmail = isEmail(target);

  const problem = mpinProblem(mpin);
  if (problem === "weak") return fail(422, "mpin_weak", { field: "mpin" });

  const roles: Role[] = role === "both" ? ["client", "provider"] : [role];
  try {
    const user = await store.createUser({
      phone: viaEmail ? "" : target, ...(viaEmail ? { email: target } : {}), name, city, roles,
      activeRole: roles[0],
      mpinHash: await hashMpin(mpin),
      failedAttempts: 0,
      lockedUntil: null,
      lang,
      isDemo: false,
      isAdmin: false,
      passkeys: [],
    });
    await clearVerifiedTicket();
    await setSessionCookie({ sub: user.id, role: user.activeRole, mpinAt: nowSec() });
    return NextResponse.json({ ok: true, user: toPublicUser(user) });
  } catch (e) {
    if (e instanceof Error && (e.message === "phone_taken" || e.message === "email_taken")) return fail(409, e.message);
    throw e;
  }
}
