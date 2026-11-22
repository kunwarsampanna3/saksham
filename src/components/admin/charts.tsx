import { num } from "@/lib/format";
import type { Lang } from "@/lib/i18n/dict";
import { DataTable } from "./ui";

/**
 * One series each, so one hue: paddy, in the step that passes 3:1 on that mode's surface.
 * Hover or focus a bar for its value. Every chart also has the same numbers as a table.
 */
const BAR = "bg-paddy-ink dark:bg-paddy";

interface Point {
  key: string;
  label: string;
  value: number;
}

/** A clean top for the axis: 1, 2, 4, 5 or 10 times a power of ten. */
function axisTop(max: number) {
  if (max <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 4, 5, 10].map((m) => m * power).find((v) => v >= max)!;
}

export function Columns({
  title,
  points,
  head,
  tableLabel,
  empty,
  lang,
}: {
  title: string;
  points: Point[];
  head: [string, string];
  tableLabel: string;
  empty: string;
  lang: Lang;
}) {
  const max = Math.max(0, ...points.map((p) => p.value));
  const top = axisTop(max);
  const every = Math.max(1, Math.ceil(points.length / 6));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-4 font-semibold">{title}</figcaption>
      {max === 0 ? (
        <p className="text-muted py-8 text-center text-sm">{empty}</p>
      ) : (
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          <div className="text-muted relative h-40 w-9 text-right text-xs" aria-hidden>
            <span className="absolute -top-2 right-0">{num(top, lang)}</span>
            <span className="absolute top-1/2 right-0 -translate-y-1/2">{num(top / 2, lang)}</span>
            <span className="absolute right-0 -bottom-2">{num(0, lang)}</span>
          </div>
          <div className="relative h-40 min-w-0">
            <div className="border-line absolute inset-x-0 top-0 border-t" aria-hidden />
            <div className="border-line absolute inset-x-0 top-1/2 border-t" aria-hidden />
            <ul className="border-line-strong relative flex h-full items-end gap-[2px] border-b">
              {points.map((p, i) => (
                <li
                  key={p.key}
                  tabIndex={0}
                  aria-label={`${p.label}: ${num(p.value, lang)}`}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
                >
                  {p.value > 0 && (
                    <span
                      className={`block w-full max-w-6 rounded-t-[4px] group-hover:opacity-75 group-focus:opacity-75 ${BAR}`}
                      style={{ height: `${Math.max(1.5, (p.value / top) * 100)}%` }}
                    />
                  )}
                  <span
                    aria-hidden
                    className={`border-line bg-surface text-text pointer-events-none absolute top-0 z-10 hidden rounded-[4px] border px-2 py-1 text-xs whitespace-nowrap shadow group-hover:block group-focus:block ${i < points.length / 2 ? "left-0" : "right-0"}`}
                  >
                    <strong>{num(p.value, lang)}</strong> · {p.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <span />
          <ul className="text-muted mt-1.5 flex h-5 gap-[2px] text-xs" aria-hidden>
            {points.map((p, i) => (
              <li key={p.key} className="relative min-w-0 flex-1">
                {i % every === 0 && (
                  <span
                    className={`absolute whitespace-nowrap ${i + every >= points.length ? "right-0" : "left-0"}`}
                  >
                    {p.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="text-muted cursor-pointer">{tableLabel}</summary>
        <DataTable
          head={head}
          empty={empty}
          rows={points.map((p) => ({ key: p.key, cells: [p.label, num(p.value, lang)] }))}
        />
      </details>
    </figure>
  );
}

/** Horizontal bars with every value written at the side, so the list is its own table. */
export function Ranked({
  title,
  points,
  empty,
  lang,
}: {
  title: string;
  points: Point[];
  empty: string;
  lang: Lang;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-3 font-semibold">{title}</figcaption>
      {!points.length ? (
        <p className="text-muted py-3 text-sm">{empty}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {points.map((p) => (
            <li
              key={p.key}
              title={`${p.label}: ${num(p.value, lang)}`}
              className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2"
            >
              <span className="truncate">{p.label}</span>
              <span className="border-line-strong block border-l">
                <span
                  className={`block h-4 rounded-r-[4px] ${BAR}`}
                  style={{ width: `${Math.max(1.5, (p.value / max) * 100)}%` }}
                />
              </span>
              <span className="text-right font-semibold">{num(p.value, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
