import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { submit, statusFor } from "@/lib/verification";

const Body = z.object({
  ward: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "ward"),
  tole: z.string().trim().min(2, "tole").max(80, "tole"),
  landmark: z.string().trim().max(80).optional().default(""),
});

/** Address = saved city/area + ward + tole. Others only ever see the area name. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "verify-address", schema: Body, limit: 10 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  if (!user.area) return fail(409, "location_first");
  await submit(user, "address", {
    fields: {
      city: user.city,
      area: user.area,
      ward: g.data.ward,
      tole: g.data.tole,
      landmark: g.data.landmark,
    },
  });
  return NextResponse.json({ ok: true, status: await statusFor(user) });
}
