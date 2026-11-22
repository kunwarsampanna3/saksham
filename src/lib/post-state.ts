import type { Task } from "@/lib/store/types";
import { postPhase } from "@/lib/business";

/** A task as it stands now: an open post whose free days are over counts as expired, swept or not. */
export function asOfNow<T extends Pick<Task, "status" | "post">>(task: T, at = Date.now()): T {
  return task.status === "open" && postPhase(task.post, at) === "expired"
    ? { ...task, status: "expired" }
    : task;
}

/** Off the site for everyone except the people already part of it. */
export const isTakenDown = (task: Pick<Task, "status" | "post" | "removed">) =>
  !!task.removed || asOfNow(task).status === "expired";
