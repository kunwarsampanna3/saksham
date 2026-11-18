import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { uploadGuard, str, file } from "@/lib/auth/upload-guard";
import { cleanImage, saveFiles, submit, statusFor, UploadError } from "@/lib/verification";
import { config } from "@/lib/config";

/**
 * Selfie match. No face-matching provider is connected, so:
 *  - DEMO_MODE: the match is SIMULATED and stored as verified + simulated (labelled in the UI);
 *  - otherwise: the selfie waits for a person to compare it with the ID.
 */
export async function POST(req: NextRequest) {
  const g = await uploadGuard(req, "verify-selfie");
  if ("res" in g) return g.res;
  const { user, form } = g;
  if (str(form, "consent") !== "yes") return fail(422, "consent", { field: "consent" });
  const status = await statusFor(user);
  if (status.id.status === "not_started" || status.id.status === "rejected") return fail(409, "id_first");
  const selfie = file(form, "selfie");
  if (!selfie) return fail(422, "file_missing", { field: "selfie" });
  try {
    const files = await saveFiles(user.id, "selfie", [{ label: "selfie", data: await cleanImage(selfie) }]);
    if (config.demoMode) {
      await submit(user, "selfie", { files, status: "verified", simulated: true, fields: { match: "simulated" } });
    } else {
      await submit(user, "selfie", { files, fields: { match: "manual" } });
    }
    return NextResponse.json({ ok: true, simulated: config.demoMode, status: await statusFor(user) });
  } catch (e) {
    if (e instanceof UploadError) return fail(422, e.message);
    throw e;
  }
}
