import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { uploadGuard, str, file } from "@/lib/auth/upload-guard";
import { cleanImage, saveFiles, submit, statusFor, UploadError } from "@/lib/verification";

/** Women-led group proof: registration certificate or ward letter, group name, member count, declaration. */
export async function POST(req: NextRequest) {
  const g = await uploadGuard(req, "verify-women");
  if ("res" in g) return g.res;
  const { user, form } = g;
  if (!user.roles.includes("provider")) return fail(403, "provider_only");
  const groupName = str(form, "groupName", 80);
  const members = str(form, "members", 3);
  if (groupName.length < 2) return fail(422, "group_name", { field: "groupName" });
  if (!/^\d{1,3}$/.test(members) || Number(members) < 1) return fail(422, "members", { field: "members" });
  if (str(form, "declaration") !== "yes") return fail(422, "declaration", { field: "declaration" });
  const proof = file(form, "proof");
  if (!proof) return fail(422, "file_missing", { field: "proof" });
  try {
    const files = await saveFiles(user.id, "womenGroup", [{ label: "proof", data: await cleanImage(proof) }]);
    await submit(user, "womenGroup", { files, fields: { groupName, members } });
    return NextResponse.json({ ok: true, status: await statusFor(user) });
  } catch (e) {
    if (e instanceof UploadError) return fail(422, e.message);
    throw e;
  }
}
