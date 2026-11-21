import type { Dict, Lang } from "@/lib/i18n/dict";
import { rs } from "@/lib/format";

/** Render a notification / system-message code in the reader's language. Unknown codes fall back safely. */
export function eventText(
  t: Dict,
  lang: Lang,
  code: string,
  params: Record<string, string | number>,
): string {
  const fn =
    (
      t.events as Record<
        string,
        (
          p: Record<string, string | number | undefined>,
          m: (v: string | number | undefined) => string,
        ) => string
      >
    )[code] ?? t.events.unknown;
  const money = (v: string | number | undefined) => rs(Number(v) || 0, lang);
  return fn(params, money);
}
