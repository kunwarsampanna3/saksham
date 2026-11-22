import { z } from "zod";

/** Nepal mobile: 10 digits starting 97 or 98 (NTC, Ncell, SmartCell). Accepts +977 / 977 prefixes and spaces. */
export function normalizeNepalPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  const local = digits.startsWith("977") && digits.length === 13 ? digits.slice(3) : digits;
  return /^9[78]\d{8}$/.test(local) ? local : null;
}

export function formatNepalPhone(local: string): string {
  return `+977 ${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

/** Last four digits only, for display in logs/UI where the full number is not needed. */
export function maskPhone(local: string): string {
  return local ? `+977 ••••••${local.slice(-4)}` : "";
}

/** Email shown as m•••@gmail.com. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return user && domain ? `${user[0]}•••@${domain}` : "";
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "email_invalid");

const WEAK_MPINS = new Set([
  "0000",
  "1111",
  "2222",
  "3333",
  "4444",
  "5555",
  "6666",
  "7777",
  "8888",
  "9999",
  "1234",
  "4321",
  "0123",
  "9876",
  "1212",
  "2580",
  "1122",
]);

export function mpinProblem(pin: string): "format" | "weak" | null {
  if (!/^\d{4}$/.test(pin)) return "format";
  if (WEAK_MPINS.has(pin)) return "weak";
  return null;
}

export const phoneSchema = z
  .string()
  .max(20)
  .transform((v, ctx) => {
    const n = normalizeNepalPhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "phone_invalid" });
      return z.NEVER;
    }
    return n;
  });

export const mpinSchema = z.string().regex(/^\d{4}$/, "mpin_format");
export const otpSchema = z.string().regex(/^\d{6}$/, "otp_format");

/** Free-text names: letters (Latin + Devanagari), spaces, apostrophes, dots, hyphens. */
export const nameSchema = z
  .string()
  .trim()
  .min(2, "name_short")
  .max(60, "name_long")
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u, "name_chars");

export const NEPAL_CITIES = [
  "Kathmandu",
  "Lalitpur",
  "Bhaktapur",
  "Pokhara",
  "Biratnagar",
  "Birgunj",
  "Dharan",
  "Bharatpur",
  "Butwal",
  "Hetauda",
  "Janakpur",
  "Nepalgunj",
  "Itahari",
  "Dhangadhi",
  "Bhairahawa",
  "Damak",
  "Birendranagar",
  "Tulsipur",
  "Ghorahi",
  "Banepa",
  "Dhulikhel",
  "Gorkha",
  "Ilam",
  "Other",
] as const;
export const citySchema = z.enum(NEPAL_CITIES);

export const roleChoiceSchema = z.enum(["client", "provider", "both"]);
export const langSchema = z.enum(["en", "ne"]);
