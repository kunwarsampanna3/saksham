import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { clearSessionCookie } from "@/lib/auth/session";
import { store } from "@/lib/store";
import { config } from "@/lib/config";
import { CATEGORY_IDS } from "@/lib/pricing";
import { DEMO_PERSONAS, demoSeed } from "@/lib/auth/demo";
import { resetExampleSeed, ensureExampleTasks } from "@/lib/tasks";
import { ensureAbroadDemo } from "@/lib/seed/abroad-demo";
import { withLock } from "@/lib/lock";
import { logAdmin } from "@/lib/admin";

const Amount = z.number().int().min(100).max(1_000_000);
const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("report"),
    id: z.string().uuid(),
    status: z.enum(["reviewing", "actioned", "dismissed"]),
  }),
  z.object({
    action: z.literal("price"),
    category: z.enum(CATEGORY_IDS),
    low: Amount,
    high: Amount,
    perDay: Amount,
  }),
  z.object({ action: z.literal("reset-demo") }),
]);

/** Admin-only actions. Everyone else gets 404 so the endpoint isn't advertised. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "admin", schema: Body, limit: 60 });
  if ("res" in g) return g.res;
  const me = await currentUser();
  if (!me?.isAdmin) return fail(404, "not_found");
  const at = new Date().toISOString();
  const d = g.data;

  if (d.action === "report") {
    const r = (await store.listReports()).find((x) => x.id === d.id);
    if (!r) return fail(404, "not_found");
    await store.putReport({ ...r, status: d.status, updatedAt: at });
    await logAdmin(me, "report", r.reason, d.status);
    return NextResponse.json({ ok: true });
  }

  if (d.action === "price") {
    if (d.low >= d.high) return fail(400, "low_high");
    await store.putPriceOverride({
      category: d.category,
      low: d.low,
      high: d.high,
      perDay: d.perDay,
      updatedBy: me.id,
      updatedAt: at,
    });
    await logAdmin(me, "price", d.category, `${d.low}–${d.high}, +${d.perDay}`);
    return NextResponse.json({ ok: true });
  }

  // reset-demo: DEMO_MODE only. Removes demo-account and example data, then re-seeds.
  if (!config.demoMode) return fail(403, "demo_only");
  await withLock("demo:accounts", async () => {
    const ids = (await Promise.all(Object.values(DEMO_PERSONAS).map((p) => store.getUserByPhone(p.phone))))
      .filter((u) => u?.isDemo)
      .map((u) => u!.id);
    await store.purgeDemoData(ids);
    await store.resetDemo(await demoSeed());
    resetExampleSeed();
    await ensureExampleTasks();
    await ensureAbroadDemo();
  });
  await logAdmin(me, "reset_demo", "");
  // The demo accounts were re-created with new ids, so this session no longer points at a user.
  if (me.isDemo) await clearSessionCookie();
  return NextResponse.json({ ok: true, signedOut: me.isDemo });
}
