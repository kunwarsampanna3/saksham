import { type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { store } from "@/lib/store";
import { loadTask } from "@/lib/task-api";

/** Task photo, served only to people allowed to see the task (women-only tasks stay hidden). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id, fileId } = await params;
  const l = await loadTask(id);
  if ("res" in l) return l.res;
  const f = l.task.photos.find((p) => p.id === fileId);
  if (!f) return fail(404, "not_found");
  const data = await store.getFile(f.path);
  if (!data) return fail(404, "not_found");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
