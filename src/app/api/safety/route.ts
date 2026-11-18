import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";
import { normalizeNepalPhone } from "@/lib/validation";
import { counterparts } from "@/lib/safety";
import { notify } from "@/lib/chat";
import { cleanText } from "@/lib/task-api";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("contacts"), contacts: z.array(z.object({ name: z.string().trim().min(2).max(60), phone: z.string().max(20) })).max(3) }),
  z.object({
    action: z.literal("report"),
    targetUserId: z.string().uuid().optional(),
    targetTaskId: z.string().min(3).max(64).optional(),
    reason: z.enum(["fraud", "harassment", "unsafe", "off_platform", "fake", "other"]),
    details: z.string().min(10, "details").max(2000),
  }),
  z.object({ action: z.literal("block"), userId: z.string().uuid() }),
  z.object({ action: z.literal("unblock"), userId: z.string().uuid() }),
  z.object({ action: z.literal("sos") }),
]);

/**
 * Safety actions. SOS and live location are DEMO in this build: nothing is sent to contacts or police.
 * Reports go to the admin queue. Blocks stop chat and new offers between the two people.
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "safety", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const d = g.data;
  const now = new Date().toISOString();

  switch (d.action) {
    case "contacts": {
      const contacts = [];
      for (const c of d.contacts) {
        const phone = normalizeNepalPhone(c.phone);
        if (!phone) return fail(422, "phone_invalid", { field: "phone" });
        if (phone === user.phone) return fail(422, "own_number", { field: "phone" });
        contacts.push({ name: cleanText(c.name, 60), phone });
      }
      await store.updateUser(user.id, { trustedContacts: contacts });
      return NextResponse.json({ ok: true });
    }
    case "report": {
      if (d.targetUserId) {
        const allowed = (await counterparts(user)).some((p) => p.id === d.targetUserId);
        if (!allowed) return fail(403, "not_counterpart");
      }
      if (d.targetTaskId && !(await store.getTask(d.targetTaskId))) return fail(404, "not_found");
      const r = await store.putReport({
        id: randomUUID(), reporterId: user.id, targetUserId: d.targetUserId, targetTaskId: d.targetTaskId,
        reason: d.reason, details: cleanText(d.details, 2000), status: "open", createdAt: now, updatedAt: now,
      });
      return NextResponse.json({ ok: true, id: r.id });
    }
    case "block": {
      if (d.userId === user.id) return fail(422, "self");
      if (!(await counterparts(user)).some((p) => p.id === d.userId)) return fail(403, "not_counterpart");
      await store.putBlock({ id: randomUUID(), blockerId: user.id, blockedId: d.userId, createdAt: now });
      return NextResponse.json({ ok: true });
    }
    case "unblock":
      await store.deleteBlock(user.id, d.userId);
      return NextResponse.json({ ok: true });
    case "sos":
      // DEMO ALERT: logged and shown to the user only. A real build would SMS trusted contacts with a live link.
      await notify(user.id, "system", "sos_demo", { contacts: (user.trustedContacts ?? []).length }, "/safety");
      return NextResponse.json({ ok: true, demo: true, contacts: (user.trustedContacts ?? []).length });
  }
}
