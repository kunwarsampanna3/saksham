import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { config } from "@/lib/config";
import { rateLimit } from "./rate-limit";
import type { User } from "@/lib/store/types";
import { getSession } from "./session";
import { currentUser } from "./current-user";
import { failBlocked } from "./blocked";
import { siteBlock } from "@/lib/controls";
import { visitorKey } from "@/lib/visitor";

export type ApiError = {
  ok: false;
  error: string;
  field?: string;
  retryAfter?: number;
  [k: string]: unknown;
};

export function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra } satisfies ApiError, { status });
}

/** With no account and no trusted IP header, every visitor shares one bucket, so it has to be bigger. */
const SHARED_BUCKET_FACTOR = 10;

/**
 * Per-caller rate limit: by account when signed in, else by IP.
 * Clients can write X-Forwarded-For themselves, so an IP header counts only if TRUSTED_IP_HEADER names one that
 * your proxy overwrites. Per-number limits (login, codes) apply on top of this.
 */
export async function callerLimit(req: NextRequest, name: string, limit: number, windowSec: number) {
  const s = await getSession();
  if (s) return rateLimit(`${name}:u:${s.sub}`, limit, windowSec);
  const ip = config.trustedIpHeader ? req.headers.get(config.trustedIpHeader)?.trim() : undefined;
  if (ip) return rateLimit(`${name}:ip:${ip}`, limit, windowSec);
  return rateLimit(`${name}:shared`, limit * SHARED_BUCKET_FACTOR, windowSec);
}

/** CSRF defence for cookie-authenticated POSTs: the Origin header must be our own. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return !config.isProd; // non-browser tools in dev
  const allowed = new Set([config.appOrigin, req.nextUrl.origin]);
  return allowed.has(origin);
}

/** Maintenance mode and the visitor limit stop changes as well as pages. */
export async function pausedFor(user: User | null): Promise<NextResponse | null> {
  const block = await siteBlock(user, await visitorKey(user?.id));
  return block ? failBlocked(block) : null;
}

/**
 * Common guard: origin check + per-caller rate limit + paused-site check + JSON body validated by a zod schema.
 * `evenWhenPaused` is for what must keep working so an admin can get back in.
 */
export async function guard<T extends z.ZodType>(
  req: NextRequest,
  opts: { name: string; schema: T; limit?: number; windowSec?: number; evenWhenPaused?: boolean },
): Promise<{ data: z.infer<T> } | { res: NextResponse }> {
  if (!sameOrigin(req)) return { res: fail(403, "bad_origin") };
  const rl = await callerLimit(req, opts.name, opts.limit ?? 20, opts.windowSec ?? 60);
  if (!rl.ok) return { res: fail(429, "rate_limited", { retryAfter: rl.retryAfter }) };
  if (!opts.evenWhenPaused) {
    const paused = await pausedFor(await currentUser());
    if (paused) return { res: paused };
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return { res: fail(400, "bad_json") };
  }
  const parsed = opts.schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { res: fail(422, issue?.message ?? "invalid", { field: issue?.path.join(".") }) };
  }
  return { data: parsed.data };
}
