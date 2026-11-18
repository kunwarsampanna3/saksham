import "server-only";
import { NextResponse } from "next/server";
import { fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";
import type { Task, User } from "@/lib/store/types";
import { canView, RuleError } from "@/lib/tasks";

/** Load the signed-in user and a task they are allowed to see (404 otherwise — no existence leak). */
export async function loadTask(id: string): Promise<{ user: User; task: Task } | { res: NextResponse }> {
  const user = await currentUser();
  if (!user) return { res: fail(401, "signed_out") };
  if (!/^[\w-]{3,64}$/.test(id)) return { res: fail(404, "not_found") };
  const task = await store.getTask(id);
  if (!task || !canView(task, user)) return { res: fail(404, "not_found") };
  return { user, task };
}

export function ruleResponse(e: unknown): NextResponse {
  if (e instanceof RuleError) return fail(e.status, e.code, e.extra);
  throw e;
}

/** Strip control characters and collapse runs of blank lines in user-written text. */
export const cleanText = (s: string, max: number) =>
  s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
