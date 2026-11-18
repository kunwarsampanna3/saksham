import { NextResponse } from "next/server";
import { currentPublicUser } from "@/lib/auth/current-user";
import { getSession, needsPaymentReauth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const [user, s] = await Promise.all([currentPublicUser(), getSession()]);
  return NextResponse.json(
    { ok: true, user, paymentReauth: s ? needsPaymentReauth(s) : true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
