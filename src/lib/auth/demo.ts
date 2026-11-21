import "server-only";
import { hashMpin } from "./mpin";
import type { User } from "@/lib/store/types";

/**
 * Example personas for DEMO_MODE only. They are labelled "Example account" in the UI
 * and removed by turning DEMO_MODE off. Numbers are in the 98000000xx test range.
 */
export const DEMO_MPIN = "2468";

export const DEMO_PERSONAS = {
  mina: {
    phone: "9800000001",
    name: "Mina Shrestha",
    city: "Bhaktapur",
    roles: ["client"],
    activeRole: "client",
    headline: "Boutique owner",
    gender: "female",
    area: "Durbar Square",
    categories: [],
  },
  bikash: {
    phone: "9800000002",
    name: "Bikash Tamang",
    city: "Kathmandu",
    roles: ["provider", "client"],
    activeRole: "provider",
    headline: "IT student · web & phone repair",
    gender: "male",
    area: "Baneshwor",
    radiusKm: 8,
    categories: ["web-design", "coding", "it-support", "phone-repair"],
  },
  aasha: {
    phone: "9800000003",
    name: "Aasha's Tailoring Group",
    city: "Bhaktapur",
    roles: ["provider"],
    activeRole: "provider",
    headline: "Women-led tailoring group",
    gender: "female",
    area: "Suryabinayak",
    radiusKm: 12,
    categories: ["tailoring"],
  },
  suman: {
    phone: "9800000004",
    name: "Suman Gurung",
    city: "Pokhara",
    roles: ["client"],
    activeRole: "client",
    headline: "Works in Doha, Qatar · hires for family in Pokhara",
    gender: "male",
    area: "Lakeside",
    categories: [],
  },
} as const satisfies Record<
  string,
  Pick<
    User,
    "phone" | "name" | "city" | "roles" | "activeRole" | "headline" | "gender" | "area" | "radiusKm"
  > & { categories: readonly string[] }
>;

export type DemoPersona = keyof typeof DEMO_PERSONAS;

export async function demoSeed(): Promise<Omit<User, "id" | "createdAt" | "updatedAt">[]> {
  const mpinHash = await hashMpin(DEMO_MPIN);
  return Object.values(DEMO_PERSONAS).map((p) => ({
    ...p,
    roles: [...p.roles],
    categories: [...p.categories],
    mpinHash,
    failedAttempts: 0,
    lockedUntil: null,
    lang: "en" as const,
    isDemo: true,
    isAdmin: p.phone === "9800000001", // Mina doubles as the demo admin so /admin can be reviewed
    passkeys: [],
  }));
}
