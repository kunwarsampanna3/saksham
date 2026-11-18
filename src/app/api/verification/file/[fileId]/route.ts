import { type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";

/** Private document viewer: only the owner (or an admin, via ?user=) can fetch an uploaded image. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const me = await currentUser();
  if (!me) return fail(401, "signed_out");
  const { fileId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(fileId)) return fail(404, "not_found");
  const owner = req.nextUrl.searchParams.get("user");
  const userId = owner && me.isAdmin ? owner : me.id;
  const f = (await store.listVerifications(userId)).flatMap((v) => v.files).find((x) => x.id === fileId);
  if (!f) return fail(404, "not_found");
  const data = await store.getFile(f.path);
  if (!data) return fail(404, "not_found");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
