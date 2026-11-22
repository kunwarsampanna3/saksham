const HERE = "http://saksham.invalid";

/**
 * Where to go after sign-in: only a path on this site.
 * Uses the browser's own URL rules, because they turn "/\evil.example" and "/<tab>/evil.example" into other sites.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/")) return "/";
  try {
    const url = new URL(next, HERE);
    const path = url.pathname + url.search + url.hash;
    // "/.//evil.example" tidies up to "//evil.example", so look at the result as well.
    return url.origin === HERE && !path.startsWith("//") ? path : "/";
  } catch {
    return "/";
  }
}
