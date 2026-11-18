import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Route guard. The login screen is the front door: every page except the auth pages,
 * public legal pages and static assets needs a valid session cookie.
 * API routes do their own checks (they return JSON 401 rather than redirecting).
 */
const PUBLIC = ["/login", "/signup", "/forgot-mpin", "/credits", "/terms", "/privacy", "/offline", "/confirm"];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const token = req.cookies.get("sk_session")?.value;
  const secret = process.env.SESSION_SECRET ?? "";
  if (token && secret.length >= 32) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret), { issuer: "saksham", algorithms: ["HS256"] });
      return NextResponse.next();
    } catch { /* fall through to login */ }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  const res = NextResponse.redirect(url);
  if (token) res.cookies.delete("sk_session");
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|photos|icon|manifest.webmanifest|sw.js|favicon.ico|robots.txt).*)"],
};
