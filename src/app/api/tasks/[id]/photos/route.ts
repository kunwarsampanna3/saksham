import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { fail } from "@/lib/auth/http";
import { uploadGuard } from "@/lib/auth/upload-guard";
import { store } from "@/lib/store";
import { cleanImage, UploadError } from "@/lib/verification";

const MAX_PHOTOS = 4;

/** Owner adds up to 4 task photos. Images are validated and re-encoded without metadata. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await uploadGuard(req, "task-photos");
  if ("res" in g) return g.res;
  const { id } = await params;
  const task = await store.getTask(id);
  if (!task || task.clientId !== g.user.id) return fail(404, "not_found");
  const files = g.form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail(422, "file_missing");
  if (task.photos.length + files.length > MAX_PHOTOS) return fail(422, "too_many_photos");
  try {
    const added = [];
    for (const f of files) {
      const data = await cleanImage(f);
      const fid = randomUUID();
      const path = `tasks/${task.id}/${fid}.jpg`;
      await store.putFile(path, data, "image/jpeg");
      added.push({ id: fid, path, mime: "image/jpeg" as const, size: data.length, label: "task" });
    }
    await store.putTask({ ...task, photos: [...task.photos, ...added], updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, count: task.photos.length + added.length });
  } catch (e) {
    if (e instanceof UploadError) return fail(422, e.message);
    throw e;
  }
}
