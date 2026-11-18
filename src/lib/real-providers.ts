import "server-only";
import { store } from "@/lib/store";
import { CATEGORY_IDS, category, type CategoryId } from "@/lib/pricing";
import type { ExampleProvider } from "@/lib/seed/providers";
import type { User } from "@/lib/store/types";

const ALL_WEEK: ExampleProvider["week"] = [true, true, true, true, true, true, true];

/**
 * A real provider account shown in the same shape as the directory cards and profile page.
 * Only facts from the account are used: name, city/area, chosen skills, verification and real ratings.
 * Price range = the fair range of their skills from the price table (not an invented quote).
 */
export async function toRealProvider(u: User): Promise<ExampleProvider> {
  const cats = (u.categories ?? []).filter((c): c is CategoryId => (CATEGORY_IDS as string[]).includes(c));
  const ratings = await store.listRatingsFor(u.id);
  const rating = ratings.length ? Math.round((ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) * 10) / 10 : 0;
  const skillNames = cats.map((c) => category(c));
  const lows = skillNames.map((c) => c.low), highs = skillNames.map((c) => c.high);
  const now = Date.now();
  const raters = await Promise.all(ratings.slice(0, 6).map((r) => store.getUserById(r.raterId)));
  return {
    id: u.id,
    name: u.name,
    kind: "person",
    headline: {
      en: u.headline ?? (skillNames.length ? skillNames.map((c) => c.en).slice(0, 3).join(" · ") : "Saksham provider"),
      ne: u.headline ?? (skillNames.length ? skillNames.map((c) => c.ne).slice(0, 3).join(" · ") : "सक्षम सेवा प्रदायक"),
    },
    bio: {
      en: `${u.name} offers ${skillNames.map((c) => c.en.toLowerCase()).join(", ") || "their skills"} in and around ${u.city}.`,
      ne: `${u.name} ${u.city} र वरपर ${skillNames.map((c) => c.ne).join(", ") || "आफ्नो सीप"} सेवा दिनुहुन्छ।`,
    },
    categories: cats,
    city: u.city,
    area: u.area ?? "",
    radiusKm: u.radiusKm ?? 10,
    onlineOk: skillNames.some((c) => c.online),
    womenLed: !!u.womenLed,
    verification: { phone: !!u.phone || !!u.verified, id: !!u.verified, selfie: !!u.verified, address: false },
    level: ratings.length >= 20 ? 3 : ratings.length >= 5 ? 2 : 1,
    rating,
    ratingCount: ratings.length,
    jobsDone: ratings.length,
    responseMinutes: 0, // not measured yet — shown as "New"
    priceMin: lows.length ? Math.min(...lows) : 0,
    priceMax: highs.length ? Math.max(...highs) : 0,
    languages: ["नेपाली", "English"],
    memberSince: u.createdAt.slice(0, 7),
    services: skillNames.map((c) => ({ en: c.en, ne: c.ne, price: c.low, unit: { en: c.unit, ne: c.unit } })),
    cover: "terraces",
    portfolio: [],
    week: ALL_WEEK,
    reviews: ratings.slice(0, 6).map((r, i) => ({
      by: raters[i]?.name.split(" ")[0] ?? "Client",
      stars: r.stars,
      text: { en: r.text, ne: r.text },
      monthsAgo: Math.max(0, Math.round((now - new Date(r.createdAt).getTime()) / (30 * 86_400_000))),
    })),
    isReal: true,
  };
}

export async function realProviders(): Promise<ExampleProvider[]> {
  return Promise.all((await store.listProviderUsers()).map(toRealProvider));
}

/** Profile lookup: an example provider by slug, or a real provider account by id. */
export async function findProvider(id: string): Promise<ExampleProvider | null> {
  const { getProvider } = await import("@/lib/seed/providers");
  const ex = getProvider(id);
  if (ex) return ex;
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const u = await store.getUserById(id);
  return u && !u.isDemo && u.roles.includes("provider") ? toRealProvider(u) : null;
}
