import Link from "next/link";
import { Download } from "lucide-react";
import {
  Badge,
  Field,
  FilterBar,
  inputCls,
  money,
  PageHeader,
  Person,
  Table,
  Card,
} from "@/components/superadmin/ui";
import { requireSuperAdmin } from "@/lib/superadmin";
import {
  DAY_RE,
  financeSnapshot,
  inDateRange,
  matchesBooking,
  PAY_STATUS,
  param,
  type PayStatus,
} from "@/lib/finance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment Management" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Payments({ searchParams }: { searchParams: SP }) {
  await requireSuperAdmin("/superadmin/payments");
  const sp = await searchParams;
  const q = param(sp.q).slice(0, 80);
  const status = param(sp.status) as PayStatus | "";
  const from = DAY_RE.test(param(sp.from)) ? param(sp.from) : "";
  const to = DAY_RE.test(param(sp.to)) ? param(sp.to) : "";
  const min = Number(param(sp.min)) || 0;
  const max = Number(param(sp.max)) || 0;

  const s = await financeSnapshot();
  const rows = s.rows
    .filter((r) => matchesBooking(r, q))
    .filter((r) => !status || r.payStatus === status)
    .filter((r) => inDateRange(r.createdAt, from || undefined, to || undefined))
    .filter((r) => (!min || r.total >= min) && (!max || r.total <= max))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sum = (k: "total" | "received" | "held" | "released") => rows.reduce((n, r) => n + r[k], 0);
  const qs = new URLSearchParams({ kind: "payments", ...(from && { from }), ...(to && { to }) });

  return (
    <>
      <PageHeader
        title="Payment Management"
        lead="Every booking's money: what the customer paid, what went to the applicant, and what is still held under the milestone rules."
      >
        <a href={`/api/superadmin/export?${qs}`} className="btn btn-ghost !min-h-10 text-sm">
          <Download size={16} aria-hidden /> Download CSV
        </a>
      </PageHeader>

      <FilterBar reset="/superadmin/payments">
        <Field label="Booking ID, customer or applicant">
          <input
            name="q"
            defaultValue={q}
            className={`${inputCls} w-64`}
            placeholder="BK-1A2B3C4D or a name"
          />
        </Field>
        <Field label="Payment status">
          <select name="status" defaultValue={status} className={inputCls}>
            <option value="">All</option>
            {(Object.keys(PAY_STATUS) as PayStatus[]).map((k) => (
              <option key={k} value={k}>
                {PAY_STATUS[k].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" name="from" defaultValue={from} className={inputCls} />
        </Field>
        <Field label="To">
          <input type="date" name="to" defaultValue={to} className={inputCls} />
        </Field>
        <Field label="Min amount">
          <input type="number" name="min" min={0} defaultValue={min || ""} className={`${inputCls} w-28`} />
        </Field>
        <Field label="Max amount">
          <input type="number" name="max" min={0} defaultValue={max || ""} className={`${inputCls} w-28`} />
        </Field>
      </FilterBar>

      <Card
        title={`${rows.length} booking${rows.length === 1 ? "" : "s"}`}
        lead={`Total ${money(sum("total"))} · received ${money(sum("received"))} · released ${money(sum("released"))} · held ${money(sum("held"))}`}
      >
        <Table
          label="Booking payments"
          empty="No bookings match these filters."
          head={[
            "Booking ID",
            "Customer",
            "Applicant",
            "Category",
            "Total",
            "Received",
            "Applicant amount",
            "Held",
            "Released",
            "Remaining",
            "Status",
            "Action",
          ]}
          rows={rows.map((r) => ({
            key: r.id,
            cells: [
              <span key="id" className="font-mono text-xs font-semibold">
                {r.ref}
              </span>,
              <Person
                key="c"
                name={r.customer.name}
                demo={r.customer.demo}
                href={
                  r.customer.account
                    ? `/superadmin/customers?q=${encodeURIComponent(r.customer.name)}`
                    : undefined
                }
              />,
              <Person
                key="a"
                name={r.applicant.name}
                demo={r.applicant.demo}
                href={r.applicant.account ? `/superadmin/applicants/${r.applicant.id}` : undefined}
              />,
              r.category,
              money(r.total),
              money(r.received),
              money(r.applicantAmount),
              <span key="h" className={r.held ? "font-semibold text-[var(--pend-text)]" : ""}>
                {money(r.held)}
              </span>,
              money(r.released),
              money(r.remaining),
              <Badge key="s" tone={PAY_STATUS[r.payStatus].tone}>
                {PAY_STATUS[r.payStatus].label}
              </Badge>,
              <Link
                key="v"
                href={`/superadmin/payments/${r.id}`}
                className="btn btn-ghost !min-h-9 !px-3 text-xs"
              >
                View
              </Link>,
            ],
          }))}
        />
      </Card>
    </>
  );
}
