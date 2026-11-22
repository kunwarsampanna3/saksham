import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { fail } from "@/lib/auth/http";
import { uploadGuard } from "@/lib/auth/upload-guard";
import { store } from "@/lib/store";
import { cleanImage, UploadError } from "@/lib/verification";
import { withLock } from "@/lib/lock";

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
    const cleaned: Buffer[] = [];
    for (const f of files) cleaned.push(await cleanImage(f));
    // Cleaning is slow and the task may have changed meanwhile (accepted, booked), so read it again.
    return await withLock(`task:${id}`, async () => {
      const fresh = await store.getTask(id);
      if (!fresh) return fail(404, "not_found");
      if (fresh.photos.length + cleaned.length > MAX_PHOTOS) return fail(422, "too_many_photos");
      const added = [];
      for (const data of cleaned) {
        const fid = randomUUID();
        const path = `tasks/${id}/${fid}.jpg`;
        await store.putFile(path, data, "image/jpeg");
        added.push({ id: fid, path, mime: "image/jpeg" as const, size: data.length, label: "task" });
      }
      const photos = [...fresh.photos, ...added];
      await store.putTask({ ...fresh, photos, updatedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true, count: photos.length });
    });
  } catch (e) {
    if (e instanceof UploadError) return fail(422, e.message);
    throw e;
  }
}
