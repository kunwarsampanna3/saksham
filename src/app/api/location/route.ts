import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { getSession } from "@/lib/auth/session";
import { store, toPublicUser } from "@/lib/store";
import { areasFor, CITY_COORDS } from "@/lib/geo";

/**
 * Save city + area (+ provider radius). Only the area centroid is stored —
 * the browser never sends raw GPS coordinates here.
 */
const Body = z.object({
  city: z.string().refine((c) => c in CITY_COORDS, "city"),
  area: z.string().max(60),
  radiusKm: z.number().int().min(1).max(50).optional(),
});

export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "location", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const s = await getSession();
  if (!s) return fail(401, "signed_out");
  const user = await store.getUserById(s.sub);
  if (!user) return fail(401, "signed_out");

  const area = areasFor(g.data.city).find((a) => a.name === g.data.area);
  if (!area) return fail(422, "area", { field: "area" });

  const updated = await store.updateUser(user.id, {
    city: g.data.city,
    area: area.name,
    lat: area.lat,
    lng: area.lng,
    ...(user.roles.includes("provider") && g.data.radiusKm ? { radiusKm: g.data.radiusKm } : {}),
  });
  const res = NextResponse.json({ ok: true, user: toPublicUser(updated) });
  res.cookies.set("city", encodeURIComponent(g.data.city), { path: "/", maxAge: 31536000, sameSite: "lax" });
  return res;
}
