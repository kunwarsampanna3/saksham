import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard } from "@/lib/auth/http";
import { getSession } from "@/lib/auth/session";
import { store } from "@/lib/store";

const Body = z.object({
  lang: z.enum(["en", "ne"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

/** Language and theme preference. Stored in cookies (and on the account when signed in). */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "prefs", schema: Body, evenWhenPaused: true, limit: 60 });
  if ("res" in g) return g.res;
  const res = NextResponse.json({ ok: true });
  const year = 60 * 60 * 24 * 365;
  if (g.data.lang) {
    res.cookies.set("lang", g.data.lang, { path: "/", maxAge: year, sameSite: "lax" });
    const s = await getSession();
    if (s) await store.updateUser(s.sub, { lang: g.data.lang }).catch(() => undefined);
  }
  if (g.data.theme) res.cookies.set("theme", g.data.theme, { path: "/", maxAge: year, sameSite: "lax" });
  return res;
}
