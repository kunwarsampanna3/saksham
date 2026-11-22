import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { cookieOptions } from "@/lib/auth/session";
import { siteBlock } from "@/lib/controls";
import { markOnline } from "@/lib/presence";
import { countBlocked, countView, pageName } from "@/lib/traffic";
import { VISIT_COOKIE, visitorKey } from "@/lib/visitor";

const Body = z.object({
  path: z.string().startsWith("/").max(300),
  /** false: still here (keeps their place), not a new page */
  view: z.boolean(),
  mobile: z.boolean(),
});

/** Each page tells the server it was opened. Answers whether the visitor should see the "paused" screen. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "traffic", schema: Body, limit: 120, evenWhenPaused: true });
  if ("res" in g) return g.res;
  const { path, view, mobile } = g.data;
  const user = await currentUser();

  let key = await visitorKey(user?.id);
  let newVisitor: string | null = null;
  if (!key) {
    newVisitor = randomUUID();
    key = `v:${newVisitor}`;
  }
  const block = await siteBlock(user, key);
  if (block) {
    if (view) countBlocked();
  } else if (!path.startsWith("/admin")) {
    const page = pageName(path);
    markOnline(key, user?.id ?? null, page);
    if (view) countView(key, page, { signedIn: !!user, mobile });
  }

  const res = NextResponse.json({ ok: true, block }, { headers: { "Cache-Control": "no-store" } });
  if (newVisitor) res.cookies.set(VISIT_COOKIE, newVisitor, { ...cookieOptions, maxAge: 86_400 });
  return res;
}
