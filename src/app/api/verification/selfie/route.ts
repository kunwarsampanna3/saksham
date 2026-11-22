import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { uploadGuard, str, file } from "@/lib/auth/upload-guard";
import { cleanImage, saveFiles, submit, statusFor, UploadError } from "@/lib/verification";
import { compareFaces, MATCH_BELOW, REVIEW_BELOW } from "@/lib/face-match";
import { store } from "@/lib/store";

/**
 * Selfie match.
 *  - Real accounts: the face on the selfie is compared with the face on the ID photo, on our server.
 *    Clear match → verified. Close call or no face on the ID → a reviewer looks. Clear mismatch → retake.
 *  - Demo accounts: no real ID photo exists, so the match is simulated and labelled.
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
    const clean = await cleanImage(selfie);

    if (user.isDemo) {
      const files = await saveFiles(user.id, "selfie", [{ label: "selfie", data: clean }]);
      await submit(user, "selfie", {
        files,
        status: "verified",
        simulated: true,
        fields: { match: "simulated" },
      });
      return NextResponse.json({ ok: true, simulated: true, status: await statusFor(user) });
    }

    const idRec = (await store.listVerifications(user.id)).find((v) => v.kind === "id");
    const front = idRec?.files.find((f) => f.label === "front");
    const idPhoto = front ? await store.getFile(front.path) : null;
    const r = idPhoto ? await compareFaces(idPhoto, clean) : { idFaces: 0, selfieFaces: 0, distance: null };

    if (idPhoto && r.selfieFaces === 0) return fail(422, "no_face", { field: "selfie" });
    if (r.selfieFaces > 1) return fail(422, "many_faces", { field: "selfie" });
    if (r.distance !== null && r.distance >= REVIEW_BELOW)
      return fail(422, "face_mismatch", { field: "selfie" });

    const files = await saveFiles(user.id, "selfie", [{ label: "selfie", data: clean }]);
    const fields = {
      match: r.distance === null ? "manual" : "auto",
      distance: r.distance === null ? "" : String(r.distance),
      idFaces: String(r.idFaces),
    };
    if (r.distance !== null && r.distance < MATCH_BELOW) {
      await submit(user, "selfie", {
        files,
        status: "verified",
        fields,
        note: "Face matched the ID photo automatically.",
      });
    } else {
      await submit(user, "selfie", { files, fields }); // pending: a reviewer compares them
    }
    return NextResponse.json({
      ok: true,
      simulated: false,
      match: fields.match,
      distance: r.distance,
      status: await statusFor(user),
    });
  } catch (e) {
    if (e instanceof UploadError) return fail(422, e.message);
    throw e;
  }
}
