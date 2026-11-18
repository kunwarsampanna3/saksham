import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { fail, sameOrigin } from "@/lib/auth/http";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail(403, "bad_origin");
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
