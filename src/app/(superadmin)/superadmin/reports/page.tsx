import { Download } from "lucide-react";
import { Columns } from "@/components/admin/charts";
import { Card, KV, money, PageHeader, Table } from "@/components/superadmin/ui";
import { requireSuperAdmin } from "@/lib/superadmin";
import { financeSnapshot, monthly } from "@/lib/finance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financial Reports" };

const REPORTS = [
  ["transactions", "All transactions", "Every money movement with IDs, statuses, who acted and references"],
  ["payments", "Booking payments", "Per booking: received, allocated, held, released, remaining"],
  ["payouts", "Applicant payouts", "Every withdrawal, its 7% fee, status and who decided"],
  ["monthly", "Monthly summary", "The last 12 months, month by month"],
] as const;

export default async function Reports() {
  await requireSuperAdmin("/superadmin/reports");
  const s = await financeSnapshot();
  const o = s.overview;
  const months = monthly(s, 12);

  return (
    <>
      <PageHeader
        title="Financial Reports"
        lead="Where the money is, what Saksham earned, and downloads for accounting."
      />

      <div className="grid min-w-0 gap-x-5 xl:grid-cols-2">
        <Card title="Where the money is now">
          <KV
            items={[
              ["Received from customers (all time)", money(o.received)],
              ["Released to applicants", money(o.distributed)],
              ["Sent to applicants' accounts", money(o.withdrawn)],
              ["Held in escrow (owed to applicants)", money(o.escrowHeld)],
              ["In applicant wallets (owed to applicants)", money(o.inWallets)],
              ["Withdrawals waiting for review", money(o.awaitingPayout)],
              ["Refunded to customers", money(o.refunded)],
            ]}
          />
        </Card>
        <Card title="Saksham revenue" lead="Only money Saksham has actually earned">
          <KV
            items={[
              ["Posting fees", money(o.revenueParts.posting)],
              ["7% on sent withdrawals", money(o.revenueParts.withdrawal)],
              ["7% at release (earlier plan)", money(o.revenueParts.release)],
              ["Total revenue", <strong key="t">{money(o.revenue)}</strong>],
              ["Escrow counted as revenue", "Never: Rs. 0"],
            ]}
          />
        </Card>
      </div>

      <Card title="Revenue by month">
        <Columns
          title="Revenue by month"
          points={months.map((m) => ({ key: m.key, label: m.label, value: m.revenue }))}
          head={["Month", "Revenue (Rs.)"]}
          tableLabel="Revenue by month as a table"
          empty="No revenue yet."
          lang="en"
        />
      </Card>

      <Card title="Month by month">
        <Table
          label="Month by month"
          head={["Month", "Received", "Released to applicants", "Refunded", "Sent to accounts", "Revenue"]}
          rows={[...months].reverse().map((m) => ({
            key: m.key,
            cells: [
              m.label,
              money(m.received),
              money(m.released),
              money(m.refunded),
              money(m.payouts),
              money(m.revenue),
            ],
          }))}
        />
      </Card>

      <Card
        title="Downloads"
        lead="CSV files open in Excel or Google Sheets. Each download is written to the audit log."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {REPORTS.map(([kind, title, about]) => (
            <li
              key={kind}
              className="border-line flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{title}</span>
                <span className="text-muted block text-xs">{about}</span>
              </span>
              <a
                href={`/api/superadmin/export?kind=${kind}`}
                className="btn btn-ghost !min-h-9 shrink-0 !px-3 text-xs"
              >
                <Download size={14} aria-hidden /> CSV
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
