import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/current-user";
import { fail } from "@/lib/auth/http";
import { statusFor } from "@/lib/verification";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  return NextResponse.json(
    { ok: true, status: await statusFor(user) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
