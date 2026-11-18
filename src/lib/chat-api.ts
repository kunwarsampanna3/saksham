import "server-only";
import type { NextResponse } from "next/server";
import { fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";
import type { Conversation, User } from "@/lib/store/types";
import { isParty } from "@/lib/chat";

/** Signed-in participant of a conversation; anyone else gets 404. */
export async function loadConversation(id: string): Promise<{ user: User; conv: Conversation } | { res: NextResponse }> {
  const user = await currentUser();
  if (!user) return { res: fail(401, "signed_out") };
  if (!/^[0-9a-f-]{36}$/.test(id)) return { res: fail(404, "not_found") };
  const conv = await store.getConversation(id);
  if (!conv || !isParty(conv, user)) return { res: fail(404, "not_found") };
  return { user, conv };
}

/** Audio check by content: WebM/Matroska, Ogg, or MP4/M4A (Safari). */
export function audioType(buf: Buffer): "audio/webm" | "audio/ogg" | "audio/mp4" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "audio/webm";
  if (buf.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (buf.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  return null;
}
