import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { siteGate } from "@/lib/site-gate";

/**
 * Site password first (see site-gate.ts), on every request including /api.
 * Then the route guard. "/" is the public front page; every other page except the auth pages,
 * public legal pages and static assets needs a valid session cookie.
 * API routes do their own checks (they return JSON 401 rather than redirecting).
 */
// The image optimizer fetches these bundled sample photos itself, without the password. Nothing private lives there.
const SAMPLE_PHOTO = new RegExp("^/photos/[a-z0-9-]+[.]webp$");
const NO_SESSION_CHECK = new RegExp(
  "^/(api|_next/image|photos|icon|manifest[.]webmanifest|sw[.]js|favicon[.]ico|robots[.]txt)",
);
const PUBLIC = [
  "/login",
  "/signup",
  "/forgot-mpin",
  "/credits",
  "/terms",
  "/privacy",
  "/offline",
  "/confirm",
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (SAMPLE_PHOTO.test(pathname)) return NextResponse.next();
  const blocked = await siteGate(req.headers.get("authorization"));
  if (blocked) return blocked;
  if (NO_SESSION_CHECK.test(pathname)) return NextResponse.next();
  // "/" itself is the public front page for visitors (it shows the app home when signed in).
  if (pathname === "/" || PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return NextResponse.next();

  const token = req.cookies.get("sk_session")?.value;
  const secret = process.env.SESSION_SECRET ?? "";
  if (token && secret.length >= 32) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "saksham", algorithms: ["HS256"] });
      return NextResponse.next();
    } catch {
      /* fall through to login */
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  const res = NextResponse.redirect(url);
  if (token) res.cookies.delete("sk_session");
  return res;
}

export const config = {
  // Only compiled JS and CSS skip the middleware. Never exclude /api here: that would bypass the site password.
  matcher: ["/((?!_next/static/).*)"],
};
