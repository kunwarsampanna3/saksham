import { CATEGORY_IDS, category, type CategoryId } from "@/lib/pricing";
import { CITY_COORDS, haversineKm, isKnownCity } from "@/lib/geo";
import { EXAMPLE_PROVIDERS, isVerified, providerCoords, type ExampleProvider } from "@/lib/seed/providers";

/** Filters shared by /explore and /professionals. Parsed defensively from the URL. */
export interface Filters {
  view: "tasks" | "pros";
  q: string;
  cat: CategoryId | "";
  city: string;
  radius: number | null; // km, null = any
  max: number | null; // NPR
  online: boolean;
  women: boolean;
  verified: boolean;
  sort: "best" | "near" | "rating" | "price";
}

export const RADII = [2, 5, 10, 25, 50] as const;
export const PRICE_CAPS = [1000, 3000, 5000, 10000, 25000, 50000] as const;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseFilters(sp: SP, fallbackCity: string, defaultView: Filters["view"] = "tasks"): Filters {
  const view = one(sp.view) === "pros" ? "pros" : one(sp.view) === "tasks" ? "tasks" : defaultView;
  const cat = one(sp.category) || one(sp.cat);
  const city = one(sp.city);
  const radius = Number(one(sp.radius));
  const max = Number(one(sp.max));
  const sort = one(sp.sort);
  return {
    view,
    q: one(sp.q).trim().slice(0, 80),
    cat: (CATEGORY_IDS as string[]).includes(cat) ? (cat as CategoryId) : "",
    city: isKnownCity(city) ? city : fallbackCity,
    radius: (RADII as readonly number[]).includes(radius) ? radius : null,
    max: (PRICE_CAPS as readonly number[]).includes(max) ? max : null,
    online: one(sp.online) === "1",
    women: one(sp.women) === "1",
    verified: one(sp.verified) === "1",
    sort: sort === "near" || sort === "rating" || sort === "price" ? sort : "best",
  };
}

/** Build a query string from filters, dropping defaults. */
export function filtersToQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  if (f.view) p.set("view", f.view);
  if (f.q) p.set("q", f.q);
  if (f.cat) p.set("category", f.cat);
  if (f.city) p.set("city", f.city);
  if (f.radius) p.set("radius", String(f.radius));
  if (f.max) p.set("max", String(f.max));
  if (f.online) p.set("online", "1");
  if (f.women) p.set("women", "1");
  if (f.verified) p.set("verified", "1");
  if (f.sort && f.sort !== "best") p.set("sort", f.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

const norm = (s: string) => s.toLowerCase().normalize("NFC");
function matches(q: string, ...fields: string[]) {
  if (!q) return true;
  const words = norm(q).split(/\s+/).filter(Boolean);
  const hay = norm(fields.join(" "));
  return words.every((w) => hay.includes(w));
}

const origin = (city: string): [number, number] | null =>
  city === "Online" ? null : (CITY_COORDS[city] ?? null);

/* ---------------------------------------------------------------- tasks */
/** Card-ready task (shared by Home, Explore and the map). Built on the server from stored tasks. */
export interface TaskResult {
  id: string;
  category: CategoryId;
  title: { en: string; ne: string };
  city: string;
  area?: string;
  womenOnly: boolean;
  forFamilyAbroad?: string;
  offers: number;
  postedMinutesAgo: number;
  isExample: boolean;
  coords: [number, number] | null;
  distanceKm: number | null;
  range: { low: number; high: number };
}

export const matchesQuery = matches;
export const originFor = origin;

/* ------------------------------------------------------------ providers */
export interface ProviderResult extends ExampleProvider {
  coords: [number, number];
  distanceKm: number | null;
  verified: boolean;
  /** 0..1 directory match score; plain code, shown with a reason */
  score: number;
}

/** `pool`: example providers for demo accounts, real provider accounts for everyone else (see real-providers.ts). */
export function searchProviders(f: Filters, pool: ExampleProvider[] = EXAMPLE_PROVIDERS): ProviderResult[] {
  const o = origin(f.city);
  return (
    pool
      .filter((p) => !f.cat || p.categories.includes(f.cat))
      .filter((p) => !f.online || p.onlineOk)
      .filter((p) => !f.women || p.womenLed)
      .filter((p) => !f.verified || isVerified(p))
      .filter((p) => !f.max || p.priceMin <= f.max)
      .filter((p) =>
        matches(
          f.q,
          p.name,
          p.headline.en,
          p.headline.ne,
          p.city,
          p.area,
          ...p.categories.flatMap((c) => [category(c).en, category(c).ne]),
          ...p.services.flatMap((s) => [s.en, s.ne]),
        ),
      )
      .map((p) => {
        const coords = providerCoords(p);
        const distanceKm = o ? Math.round(haversineKm(o, coords) * 10) / 10 : null;
        const verified = isVerified(p);
        const dist =
          distanceKm === null
            ? 0.9
            : p.onlineOk && distanceKm > 25
              ? 0.9
              : Math.max(0, 1 - Math.max(0, distanceKm - 2) / 23);
        const score =
          0.4 * (p.rating / 5) + 0.3 * dist + 0.2 * (verified ? 1 : 0) + 0.1 * Math.min(p.jobsDone / 50, 1);
        return { ...p, coords, distanceKm, verified, score: Math.round(score * 1000) / 1000 };
      })
      // Within the radius, or anywhere when the viewer asked for online-capable providers.
      .filter((p) => !f.radius || p.distanceKm === null || p.distanceKm <= f.radius || f.online)
      .sort((a, b) => {
        if (f.sort === "near") return (a.distanceKm ?? 0) - (b.distanceKm ?? 0);
        if (f.sort === "rating") return b.rating - a.rating || b.ratingCount - a.ratingCount;
        if (f.sort === "price") return a.priceMin - b.priceMin;
        return b.score - a.score;
      })
  );
}
