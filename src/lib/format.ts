import { toDeva, type Lang } from "@/lib/i18n/dict";

/** Indian/Nepali digit grouping (1,84,000), Devanagari digits in Nepali. */
export function num(n: number, lang: Lang): string {
  const s = Math.round(n).toLocaleString("en-IN");
  return lang === "ne" ? toDeva(s) : s;
}

export const rs = (n: number, lang: Lang) => (lang === "ne" ? `रु. ${num(n, lang)}` : `Rs. ${num(n, lang)}`);

export const rsRange = (lo: number, hi: number, lang: Lang) =>
  lang === "ne" ? `रु. ${num(lo, lang)}–${num(hi, lang)}` : `Rs. ${num(lo, lang)}–${num(hi, lang)}`;

const MONTHS = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  ne: ["जनवरी", "फेब्रुअरी", "मार्च", "अप्रिल", "मे", "जुन", "जुलाई", "अगस्ट", "सेप्टेम्बर", "अक्टोबर", "नोभेम्बर", "डिसेम्बर"],
};

/**
 * Date in Nepal time (UTC+5:45), formatted the same on server and browser.
 * (Browsers often lack Nepali locale data, so Intl output differs and breaks hydration.)
 * Accepts "YYYY-MM-DD" or a full ISO timestamp.
 */
export function npDate(value: string, lang: Lang, opts: { year?: boolean; time?: boolean } = {}): string {
  let y: number, m: number, d: number, hh = 0, mm = 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    [y, m, d] = value.split("-").map(Number);
  } else {
    const t = new Date(new Date(value).getTime() + (5 * 60 + 45) * 60_000);
    y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate(); hh = t.getUTCHours(); mm = t.getUTCMinutes();
  }
  const time = opts.time ? `, ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` : "";
  const s = `${d} ${MONTHS[lang][m - 1]}${opts.year === false ? "" : ` ${y}`}${time}`;
  return lang === "ne" ? toDeva(s) : s;
}

/** EXAMPLE exchange rate, always labelled as such on screen. Not a live rate. */
export const EXAMPLE_USD_RATE = 133;
export const approxUsd = (npr: number) => Math.round(npr / EXAMPLE_USD_RATE);
