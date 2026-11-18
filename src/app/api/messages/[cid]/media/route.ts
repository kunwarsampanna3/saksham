import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { fail } from "@/lib/auth/http";
import { uploadGuard, str, file } from "@/lib/auth/upload-guard";
import { store } from "@/lib/store";
import { audioType, loadConversation } from "@/lib/chat-api";
import { BlockedError, sendMessage } from "@/lib/chat";
import { cleanImage, UploadError } from "@/lib/verification";

const MAX_VOICE_BYTES = 2 * 1024 * 1024;
const MAX_VOICE_SEC = 120;

/** Photo (re-encoded, metadata stripped) or voice note (≤ 2 min, ≤ 2 MB, checked by content). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const g = await uploadGuard(req, "chat-media");
  if ("res" in g) return g.res;
  const l = await loadConversation((await params).cid);
  if ("res" in l) return l.res;
  const kind = str(g.form, "kind");
  const f = file(g.form, "file");
  if (!f) return fail(422, "file_missing");
  const id = randomUUID();
  try {
    if (kind === "photo") {
      const data = await cleanImage(f);
      const path = `chat/${l.conv.id}/${id}.jpg`;
      await store.putFile(path, data, "image/jpeg");
      const r = await sendMessage(l.conv, l.user, { kind: "photo", body: "", file: { id, path, mime: "image/jpeg", size: data.length, label: "photo" } });
      return NextResponse.json({ ok: true, id: r.message.id });
    }
    if (kind === "voice") {
      if (f.size > MAX_VOICE_BYTES) return fail(422, "file_too_big");
      const buf = Buffer.from(await f.arrayBuffer());
      const mime = audioType(buf);
      if (!mime) return fail(422, "file_type");
      const durationSec = Math.min(MAX_VOICE_SEC, Math.max(1, Math.round(Number(str(g.form, "durationSec", 5)) || 1)));
      const path = `chat/${l.conv.id}/${id}.${mime.split("/")[1]}`;
      await store.putFile(path, buf, mime);
      const r = await sendMessage(l.conv, l.user, { kind: "voice", body: "", file: { id, path, mime, size: buf.length, label: "voice", durationSec } });
      return NextResponse.json({ ok: true, id: r.message.id });
    }
    return fail(422, "kind");
  } catch (e) {
    if (e instanceof UploadError) return fail(422, e.message);
    if (e instanceof BlockedError) return fail(403, "blocked");
    throw e;
  }
}
