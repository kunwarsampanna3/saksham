import "server-only";
import type { NextRequest } from "next/server";
import { fail, pausedFor, sameOrigin } from "./http";
import { rateLimit } from "./rate-limit";
import { currentUser } from "./current-user";
import type { User } from "@/lib/store/types";

/** Guard for multipart uploads: same origin, signed in, rate-limited per account. */
export async function uploadGuard(
  req: NextRequest,
  name: string,
): Promise<{ user: User; form: FormData } | { res: Response }> {
  if (!sameOrigin(req)) return { res: fail(403, "bad_origin") };
  const user = await currentUser();
  if (!user) return { res: fail(401, "signed_out") };
  const paused = await pausedFor(user);
  if (paused) return { res: paused };
  const rl = rateLimit(`${name}:u:${user.id}`, 10, 3600);
  if (!rl.ok) return { res: fail(429, "rate_limited", { retryAfter: rl.retryAfter }) };
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 20 * 1024 * 1024) return { res: fail(413, "file_too_big") };
  try {
    return { user, form: await req.formData() };
  } catch {
    return { res: fail(400, "bad_form") };
  }
}

export const str = (f: FormData, k: string, max = 120) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
};

export const file = (f: FormData, k: string) => {
  const v = f.get(k);
  return v instanceof File && v.size > 0 ? v : null;
};
