import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { withdraw, statusFor } from "@/lib/verification";

const Body = z.object({ kind: z.enum(["id", "selfie", "address", "womenGroup"]) });

/** Delete my documents for a step and reset it. Removing the ID also removes the selfie match. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "verify-withdraw", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  await withdraw(user, g.data.kind);
  return NextResponse.json({ ok: true, status: await statusFor(user) });
}
