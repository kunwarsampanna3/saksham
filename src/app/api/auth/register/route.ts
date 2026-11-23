import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import {
  citySchema,
  langSchema,
  mpinProblem,
  mpinSchema,
  nameSchema,
  roleChoiceSchema,
} from "@/lib/validation";
import { store, toPublicUser } from "@/lib/store";
import { hashMpin } from "@/lib/auth/mpin";
import { clearVerifiedTicket, readVerifiedTicket } from "@/lib/auth/otp";
import { startSession } from "@/lib/auth/session";
import type { Role } from "@/lib/store/types";
import { CATEGORY_IDS } from "@/lib/pricing";
import { isEmail } from "@/lib/auth/target";
import { switchedOff } from "@/lib/controls";

const Body = z.object({
  name: nameSchema,
  city: citySchema,
  role: roleChoiceSchema,
  mpin: mpinSchema,
  lang: langSchema.default("en"),
  categories: z.array(z.enum(CATEGORY_IDS)).max(20).default([]),
  marketingOptIn: z.boolean().default(false),
  acceptTerms: z.literal(true, { message: "terms_required" }),
});

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "register", schema: Body, limit: 5, windowSec: 60 });
  if ("res" in g) return g.res;
  const { name, city, role, mpin, lang, categories, marketingOptIn } = g.data;
  const off = await switchedOff("signups", null);
  if (off) return off;
  // Providers say what they do, so the right tasks reach them.
  if (role !== "client" && categories.length === 0)
    return fail(422, "categories_required", { field: "categories" });

  // The verified phone or email comes from the OTP ticket cookie, never from the request body.
  const ticket = await readVerifiedTicket("signup");
  if (!ticket) return fail(401, "otp_required");
  const { target } = ticket;
  const viaEmail = isEmail(target);

  const problem = mpinProblem(mpin);
  if (problem === "weak") return fail(422, "mpin_weak", { field: "mpin" });

  const roles: Role[] = role === "both" ? ["client", "provider"] : [role];
  try {
    const user = await store.createUser({
      phone: viaEmail ? "" : target,
      ...(viaEmail ? { email: target } : {}),
      name,
      city,
      roles,
      activeRole: roles[0],
      mpinHash: await hashMpin(mpin),
      failedAttempts: 0,
      lockedUntil: null,
      lang,
      isDemo: false,
      isAdmin: false,
      passkeys: [],
      categories: [...new Set(categories)],
      marketingOptIn,
      termsAcceptedAt: new Date().toISOString(),
    });
    await clearVerifiedTicket();
    await startSession(user);
    return NextResponse.json({ ok: true, user: toPublicUser(user) });
  } catch (e) {
    if (e instanceof Error && (e.message === "phone_taken" || e.message === "email_taken"))
      return fail(409, e.message);
    throw e;
  }
}
