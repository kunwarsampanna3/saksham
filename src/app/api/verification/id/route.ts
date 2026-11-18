import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { uploadGuard, str, file } from "@/lib/auth/upload-guard";
import { cleanImage, saveFiles, submit, statusFor, UploadError } from "@/lib/verification";

const DOC_TYPES = ["citizenship", "national_id", "student_id"] as const;

/** Citizenship / national ID (front + back) or student ID (front, back optional). Goes to manual review. */
export async function POST(req: NextRequest) {
  const g = await uploadGuard(req, "verify-id");
  if ("res" in g) return g.res;
  const { user, form } = g;
  const docType = str(form, "docType") as (typeof DOC_TYPES)[number];
  if (!DOC_TYPES.includes(docType)) return fail(422, "doc_type", { field: "docType" });
  if (str(form, "consent") !== "yes") return fail(422, "consent", { field: "consent" });
  const front = file(form, "front");
  const back = file(form, "back");
  if (!front) return fail(422, "file_missing", { field: "front" });
  if (docType !== "student_id" && !back) return fail(422, "file_missing", { field: "back" });
  try {
    const items = [{ label: "front", data: await cleanImage(front) }];
    if (back) items.push({ label: "back", data: await cleanImage(back) });
    const files = await saveFiles(user.id, "id", items);
    await submit(user, "id", { files, fields: { docType } });
    return NextResponse.json({ ok: true, status: await statusFor(user) });
  } catch (e) {
    if (e instanceof UploadError) return fail(422, e.message);
    throw e;
  }
}
