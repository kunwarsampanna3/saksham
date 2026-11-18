import { type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { store } from "@/lib/store";
import { loadConversation } from "@/lib/chat-api";

/** Chat photo or voice note, for the two participants only. Supports Range so audio can seek. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ cid: string; mid: string }> }) {
  const { cid, mid } = await params;
  const l = await loadConversation(cid);
  if ("res" in l) return l.res;
  const m = (await store.listMessages(l.conv.id)).find((x) => x.id === mid);
  if (!m?.file) return fail(404, "not_found");
  const data = await store.getFile(m.file.path);
  if (!data) return fail(404, "not_found");
  const headers: Record<string, string> = {
    "Content-Type": m.file.mime, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Accept-Ranges": "bytes",
  };
  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
    if (start > end || start >= data.length) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${data.length}` } });
    return new Response(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${data.length}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(new Uint8Array(data), { headers: { ...headers, "Content-Length": String(data.length) } });
}
