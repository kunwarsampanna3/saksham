import "server-only";
import { cookies, headers } from "next/headers";
import { dicts, type Lang } from "./dict";

/** Language: explicit cookie → browser Accept-Language → English. */
export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get("lang")?.value;
  if (c === "en" || c === "ne") return c;
  const al = (await headers()).get("accept-language") ?? "";
  return /^ne\b|,\s*ne\b/i.test(al) ? "ne" : "en";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: dicts[lang] };
}

export type ThemePref = "light" | "dark" | "system";
export async function getThemePref(): Promise<ThemePref> {
  const v = (await cookies()).get("theme")?.value;
  return v === "light" || v === "dark" ? v : "system";
}

/** Chosen city from the header picker (cookie), else the account's city, else Kathmandu. */
export async function getCity(fallback?: string): Promise<string> {
  const { isKnownCity } = await import("@/lib/geo");
  const c = decodeURIComponent((await cookies()).get("city")?.value ?? "");
  if (isKnownCity(c)) return c;
  return isKnownCity(fallback) ? fallback : "Kathmandu";
}
