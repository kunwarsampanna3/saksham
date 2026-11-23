import Link from "next/link";
import {
  Badge,
  Card,
  Field,
  FilterBar,
  inputCls,
  money,
  PageHeader,
  Person,
  Table,
  Tabs,
} from "@/components/superadmin/ui";
import { requireSuperAdmin } from "@/lib/superadmin";
import {
  complaints,
  financeSnapshot,
  matchesBooking,
  PAY_STATUS,
  STAGE,
  param,
  type BookingRow,
} from "@/lib/finance";
import { npDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking Management" };

type SP = Promise<Record<string, string | string[] | undefined>>;

const VIEWS: Record<string, { label: string; test: (r: BookingRow) => boolean }> = {
  all: { label: "All", test: () => true },
  ongoing: { label: "Ongoing work", test: (r) => r.status === "active" },
  pending: {
    label: "Pending milestone updates",
    test: (r) => r.status === "active" && ["advance_paid", "half_reported", "delivered"].includes(r.stage),
  },
  completed: { label: "Completed", test: (r) => r.status === "completed" },
  cancelled: { label: "Cancelled / refunded", test: (r) => r.status === "refunded" },
  disputed: { label: "Disputed", test: (r) => r.status === "disputed" },
};

const KIND = {
  customer: "Customer complaint",
  applicant: "Applicant complaint",
  payment: "Payment dispute",
  report: "Safety report",
};

export default async function Bookings({ searchParams }: { searchParams: SP }) {
  await requireSuperAdmin("/superadmin/bookings");
  const sp = await searchParams;
  const view = VIEWS[param(sp.view)] ? param(sp.view) : "all";
  const q = param(sp.q).slice(0, 80);
  const s = await financeSnapshot();
  const rows = s.rows
    .filter(VIEWS[view].test)
    .filter((r) => matchesBooking(r, q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const list = complaints(s);
  const link = (k: string) => `/superadmin/bookings?view=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        title="Booking Management"
        lead="Every booking and where it stands, with complaints from both sides."
      />
      <Tabs
        current={view}
        items={Object.entries(VIEWS).map(([k, v]) => ({
          key: k,
          label: v.label,
          href: link(k),
          count: s.rows.filter(v.test).length,
        }))}
      />
      <FilterBar reset={`/superadmin/bookings?view=${view}`}>
        <input type="hidden" name="view" value={view} />
        <Field label="Booking ID, job or person">
          <input name="q" defaultValue={q} className={`${inputCls} w-64`} />
        </Field>
      </FilterBar>
      <Card title={VIEWS[view].label}>
        <Table
          label="Bookings"
          empty="No bookings here."
          head={[
            "Booking",
            "Job",
            "Customer",
            "Applicant",
            "Milestone",
            "Total",
            "Held",
            "Status",
            "Updated",
          ]}
          rows={rows.map((r) => ({
            key: r.id,
            cells: [
              <Link
                key="b"
                href={`/superadmin/payments/${r.id}`}
                className="text-accent font-mono text-xs font-semibold hover:underline"
              >
                {r.ref}
              </Link>,
              <span key="j">
                {r.title}
                <span className="text-muted block text-xs">{r.category}</span>
              </span>,
              <Person key="c" name={r.customer.name} demo={r.customer.demo} />,
              <Person
                key="a"
                name={r.applicant.name}
                demo={r.applicant.demo}
                href={r.applicant.account ? `/superadmin/applicants/${r.applicant.id}` : undefined}
              />,
              STAGE[r.stage],
              money(r.total),
              money(r.held),
              <Badge key="s" tone={PAY_STATUS[r.payStatus].tone}>
                {PAY_STATUS[r.payStatus].label}
              </Badge>,
              npDate(r.updatedAt, "en", { time: true }),
            ],
          }))}
        />
      </Card>
      <Card title="Complaints" lead="Disputes opened by customers or applicants, and safety reports">
        <Table
          label="Complaints"
          empty="No complaints."
          head={["When", "Type", "From", "About", "Details", "Status"]}
          rows={list.slice(0, 50).map((c) => ({
            key: c.id,
            cells: [
              npDate(c.at, "en", { time: true }),
              KIND[c.kind],
              <Person key="w" name={c.who} demo={c.demo} />,
              c.about,
              c.text,
              <Badge key="s" tone={c.open ? "bad" : "plain"}>
                {c.status}
              </Badge>,
            ],
          }))}
        />
      </Card>
    </>
  );
}
