/**
 * One password in front of the whole site, for private demo deploys.
 * Runs in middleware, so it must stay free of Node-only imports.
 *
 * - SITE_PASSWORD set: every request needs it (browser's own password box; any username).
 * - Not set on Render while DEMO_MODE=true: locked, because demo mode gives away admin and sign-in codes,
 *   unless PUBLIC_DEMO=true: then it's open, with uploads and the site switches turned off (see config.publicDemo).
 * - Not set anywhere else (your laptop): no password.
 */
const MIN_LENGTH = 12;

const deny = (status: number, message: string, headers: Record<string, string> = {}) =>
  new Response(message, {
    status,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers },
  });

const digest = async (text: string) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

/** The password from a Basic auth header, or null when there isn't a readable one. */
function sentPassword(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0)));
    const colon = decoded.indexOf(":");
    return colon < 0 ? null : decoded.slice(colon + 1);
  } catch {
    return null;
  }
}

/** Returns the response that blocks the request, or null when it may continue. */
export async function siteGate(authorization: string | null): Promise<Response | null> {
  const password = process.env.SITE_PASSWORD ?? "";
  if (!password) {
    const demoOnRender = process.env.RENDER === "true" && process.env.DEMO_MODE === "true";
    const openOnPurpose = process.env.PUBLIC_DEMO === "true";
    return demoOnRender && !openOnPurpose
      ? deny(503, "Locked: set SITE_PASSWORD, or PUBLIC_DEMO=true for an open demo with example accounts only.")
      : null;
  }
  if (password.length < MIN_LENGTH)
    return deny(503, `Locked: SITE_PASSWORD needs at least ${MIN_LENGTH} characters.`);

  const sent = sentPassword(authorization);
  if (sent !== null) {
    // Compare hashes byte by byte so timing says nothing about the password.
    const [a, b] = await Promise.all([digest(sent), digest(password)]);
    if (a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0) return null;
  }
  return deny(401, "Password required.", {
    "WWW-Authenticate": 'Basic realm="Saksham demo", charset="UTF-8"',
  });
}
