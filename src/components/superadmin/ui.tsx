import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { rs } from "@/lib/format";
import type { Tone } from "@/lib/finance";

/** Building blocks for /superadmin. English only: it's an internal tool for Saksham's admin. */
export const money = (n: number) => rs(n, "en");

const TONE: Record<Tone, string> = {
  good: "bg-[var(--ok-soft)] text-[var(--ok-text)]",
  pending: "bg-[var(--pend-soft)] text-[var(--pend-text)]",
  bad: "bg-[var(--bad-soft)] text-[var(--bad-text)]",
  plain: "bg-surface-2 text-muted",
};
const DOT: Record<Tone, string> = {
  good: "bg-[var(--ok-text)]",
  pending: "bg-[var(--pend-text)]",
  bad: "bg-[var(--bad-text)]",
  plain: "bg-[var(--text-muted)]",
};

export function Badge({ tone = "plain", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

export const DemoTag = () => (
  <span className="demo-tag ml-1 align-middle" title="Demo data: simulated, no real money">
    Demo
  </span>
);

export function PageHeader({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {lead && <p className="text-muted mt-1 max-w-3xl text-sm sm:text-base">{lead}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  note,
  tone,
  Icon,
  href,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: Tone;
  Icon?: LucideIcon;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <dt className="text-muted text-sm font-medium">{label}</dt>
        {Icon && (
          <span
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE[tone ?? "plain"]}`}
          >
            <Icon size={16} aria-hidden />
          </span>
        )}
      </div>
      <dd className="mt-1 text-2xl font-bold tracking-tight break-words tabular-nums">{value}</dd>
      {note && <dd className="text-muted mt-1 text-xs">{note}</dd>}
    </>
  );
  const cls = "border-line bg-surface block min-w-0 rounded-xl border p-4 shadow-sm";
  return href ? (
    <Link href={href} className={`${cls} hover:border-accent transition-colors`} data-stat={label}>
      {body}
    </Link>
  ) : (
    <div className={cls} data-stat={label}>
      {body}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</dl>;
}

export function Card({
  title,
  lead,
  action,
  children,
  id,
}: {
  title?: string;
  lead?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="border-line bg-surface mt-5 min-w-0 rounded-xl border p-4 shadow-sm sm:p-5">
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="text-lg font-bold">{title}</h2>}
            {lead && <p className="text-muted text-sm">{lead}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Table({
  head,
  rows,
  empty = "Nothing here yet.",
  label,
}: {
  head: string[];
  rows: { key: string; cells: ReactNode[]; tone?: Tone }[];
  empty?: string;
  label: string;
}) {
  if (!rows.length) return <p className="text-muted py-4 text-sm">{empty}</p>;
  return (
    // Focusable so a wide table can be scrolled with the keyboard; the page itself never scrolls sideways.
    <div
      className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5"
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="text-muted border-line border-b text-xs tracking-wide uppercase">
            {head.map((h, i) => (
              <th key={i} scope="col" className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-surface-2/60 align-top">
              {r.cells.map((c, i) => (
                <td key={i} className="max-w-[18rem] py-2.5 pr-4 break-words tabular-nums">
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

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="border-line flex justify-between gap-3 border-b py-1.5">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Plain GET form: filters live in the URL, so a filtered view can be shared and works without JavaScript. */
export function FilterBar({ children, reset }: { children: ReactNode; reset: string }) {
  return (
    <form
      method="get"
      className="border-line bg-surface mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-3 shadow-sm"
    >
      {children}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary !min-h-10 text-sm">
          Apply
        </button>
        <Link href={reset} className="btn btn-ghost !min-h-10 text-sm">
          Clear
        </Link>
      </div>
    </form>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "input !min-h-10 !py-1.5 text-sm";

export function Tabs({
  items,
  current,
}: {
  items: { key: string; label: string; href: string; count?: number }[];
  current: string;
}) {
  return (
    <nav aria-label="Views" className="mb-4 flex gap-1 overflow-x-auto pb-1">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${t.key === current ? "bg-[var(--sa-navy)] text-white" : "bg-surface border-line hover:border-accent border"}`}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={`rounded-full px-1.5 text-xs ${t.key === current ? "bg-white/20" : "bg-surface-2"}`}
            >
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Person({ name, demo, href }: { name: string; demo: boolean; href?: string }) {
  return (
    <span>
      {href ? (
        <Link href={href} className="hover:underline">
          {name}
        </Link>
      ) : (
        name
      )}
      {demo && <DemoTag />}
    </span>
  );
}
