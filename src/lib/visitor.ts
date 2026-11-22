import "server-only";
import { cookies } from "next/headers";

export const VISIT_COOKIE = "sk_visit";

/** A visitor's presence key: the account when signed in, otherwise a random id in a cookie. */
export async function visitorKey(userId?: string | null): Promise<string | null> {
  if (userId) return `u:${userId}`;
  const v = (await cookies()).get(VISIT_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/.test(v) ? `v:${v}` : null;
}
