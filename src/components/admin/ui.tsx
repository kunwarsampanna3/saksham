import type { ReactNode } from "react";

/** Small building blocks shared by the dashboard's pages. */
export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {lead && <p className="text-muted mt-1">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

export function Stats({ items }: { items: { label: string; value: ReactNode; note?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="border-line bg-surface min-w-0 rounded-[10px] border p-4"
          data-stat={s.label}
        >
          <dt className="text-muted text-sm">{s.label}</dt>
          <dd className="mt-1 text-xl leading-tight font-semibold break-words sm:text-2xl">{s.value}</dd>
          {s.note && <dd className="text-muted text-xs">{s.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function Panel({
  title,
  lead,
  children,
  action,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border-line bg-surface mt-5 min-w-0 rounded-[10px] border p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">{title}</h2>
          {lead && <p className="text-muted text-sm">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DataTable({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: { key: string; cells: ReactNode[] }[];
  empty: string;
}) {
  if (!rows.length) return <p className="text-muted py-3">{empty}</p>;
  return (
    // Focusable, so a wide table can be scrolled with the keyboard.
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={head.filter(Boolean).join(", ")}>
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="text-muted border-line border-b">
            {head.map((h, i) => (
              <th key={i} scope="col" className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {rows.map((r) => (
            <tr key={r.key} className="align-top">
              {r.cells.map((c, i) => (
                <td key={i} className="max-w-[20rem] py-2.5 pr-4 break-words">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE = {
  plain: "bg-surface-2 text-text",
  good: "bg-accent-soft text-accent",
  bad: "bg-danger-soft text-danger",
} as const;

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: keyof typeof TONE }) {
  return (
    <span className={`mr-1 inline-block rounded-[3px] px-1.5 py-0.5 text-xs font-bold ${TONE[tone]}`}>
      {children}
    </span>
  );
}
