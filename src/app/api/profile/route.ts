import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { store } from "@/lib/store";
import { CATEGORY_IDS } from "@/lib/pricing";

const Body = z.object({ categories: z.array(z.enum(CATEGORY_IDS)).max(20) });

/** Change your own skills. Applicants keep at least one, so jobs can still be matched to them. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "profile", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const user = await currentUser();
  if (!user) return fail(401, "signed_out");
  const categories = [...new Set(g.data.categories)];
  if (user.roles.includes("provider") && categories.length === 0)
    return fail(422, "categories_required", { field: "categories" });
  await store.updateUser(user.id, { categories });
  return NextResponse.json({ ok: true, categories });
}
