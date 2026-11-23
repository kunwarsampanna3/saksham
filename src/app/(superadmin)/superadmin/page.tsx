import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  BadgeCheck,
  CalendarClock,
  CircleDollarSign,
  Hourglass,
  Landmark,
  PiggyBank,
} from "lucide-react";
import { Columns } from "@/components/admin/charts";
import {
  Badge,
  Card,
  money,
  PageHeader,
  Person,
  StatCard,
  StatGrid,
  Table,
} from "@/components/superadmin/ui";
import { requireSuperAdmin } from "@/lib/superadmin";
import { financeSnapshot, monthly, PAY_STATUS, PAYOUT_STATUS, STAGE, TXN_TYPE } from "@/lib/finance";
import { npDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function Overview() {
  await requireSuperAdmin("/superadmin");
  const s = await financeSnapshot();
  const o = s.overview;
  const months = monthly(s);
  const demoOnly = s.rows.length > 0 && s.rows.every((r) => r.demo);

  return (
    <>
      <PageHeader
        title="Overview"
        lead="Money in, money held for applicants, money paid out, and what Saksham actually earned. Escrow is never counted as revenue."
      />
      {demoOnly && (
        <p className="mb-4 rounded-lg bg-[var(--pend-soft)] p-3 text-sm text-[var(--pend-text)]">
          Every booking here is demo data between example accounts: simulated sandbox payments, no real money.
        </p>
      )}

      <StatGrid>
        <StatCard
          label="Received from customers"
          value={money(o.received)}
          note="All booking payments (each 50%)"
          Icon={CircleDollarSign}
          tone="good"
          href="/superadmin/transactions?type=customer_payment"
        />
        <StatCard
          label="Distributed to applicants"
          value={money(o.distributed)}
          note={`Released from escrow. ${money(o.withdrawn)} already sent to their accounts.`}
          Icon={ArrowDownToLine}
          tone="good"
          href="/superadmin/transactions?type=escrow_release"
        />
        <StatCard
          label="Held by Saksham"
          value={money(o.heldBySaksham)}
          note={`${money(o.escrowHeld)} in escrow + ${money(Math.max(0, o.heldBySaksham - o.escrowHeld))} in applicant balances. It belongs to applicants, not Saksham.`}
          Icon={Landmark}
          tone="pending"
        />
        <StatCard
          label="Pending payment releases"
          value={money(o.awaitingPayout)}
          note={`${o.awaitingPayoutCount} withdrawal${o.awaitingPayoutCount === 1 ? "" : "s"} waiting for review`}
          Icon={Hourglass}
          tone={o.awaitingPayoutCount ? "pending" : "plain"}
          href="/superadmin/releases"
        />
      </StatGrid>
      <div className="mt-3">
        <StatGrid>
          <StatCard
            label="Completed bookings"
            value={o.completed}
            Icon={BadgeCheck}
            tone="good"
            href="/superadmin/bookings?view=completed"
          />
          <StatCard
            label="Active bookings"
            value={o.active}
            note={o.onHold ? `${o.onHold} on finance hold` : undefined}
            Icon={CalendarClock}
            tone="pending"
            href="/superadmin/bookings?view=ongoing"
          />
          <StatCard
            label="Disputed bookings"
            value={o.disputed}
            Icon={AlertTriangle}
            tone={o.disputed ? "bad" : "plain"}
            href="/superadmin/disputes"
          />
          <StatCard
            label="Saksham revenue"
            value={money(o.revenue)}
            note={`Earned only: posting ${money(o.revenueParts.posting)} · 7% withdrawal ${money(o.revenueParts.withdrawal)} · earlier-plan 7% ${money(o.revenueParts.release)}`}
            Icon={PiggyBank}
            tone="good"
            href="/superadmin/reports"
          />
        </StatGrid>
      </div>

      <div className="grid min-w-0 gap-x-5 xl:grid-cols-2">
        <Card title="Monthly payments" lead="Money received from customers, last 6 months">
          <Columns
            title="Received from customers"
            points={months.map((m) => ({ key: m.key, label: m.label, value: m.received }))}
            head={["Month", "Received (Rs.)"]}
            tableLabel="Monthly payments as a table"
            empty="No payments yet."
            lang="en"
          />
        </Card>
        <Card
          title="Revenue analytics"
          lead="What Saksham earned: posting fees and the 7% fees, last 6 months"
        >
          <Columns
            title="Saksham revenue"
            points={months.map((m) => ({ key: m.key, label: m.label, value: m.revenue }))}
            head={["Month", "Revenue (Rs.)"]}
            tableLabel="Monthly revenue as a table"
            empty="No revenue yet."
            lang="en"
          />
        </Card>
      </div>

      <div className="grid min-w-0 gap-x-5 xl:grid-cols-2">
        <Card
          title="Pending approvals"
          lead="Withdrawals waiting for your approval"
          action={
            <Link className="text-accent text-sm font-semibold hover:underline" href="/superadmin/releases">
              Open releases
            </Link>
          }
        >
          <Table
            label="Pending approvals"
            head={["Applicant", "Amount", "Requested", "Status"]}
            empty="Nothing is waiting."
            rows={s.payoutRows
              .filter((p) => p.payout.status === "requested" || p.payout.status === "on_hold")
              .slice(0, 6)
              .map((p) => ({
                key: p.payout.id,
                cells: [
                  <Person key="a" name={p.applicant.name} demo={p.applicant.demo} />,
                  money(p.payout.amount),
                  npDate(p.payout.createdAt, "en", { time: true }),
                  <Badge key="s" tone={PAYOUT_STATUS[p.payout.status].tone}>
                    {PAYOUT_STATUS[p.payout.status].label}
                  </Badge>,
                ],
              }))}
          />
        </Card>
        <Card
          title="Latest booking activity"
          action={
            <Link className="text-accent text-sm font-semibold hover:underline" href="/superadmin/bookings">
              All bookings
            </Link>
          }
        >
          <Table
            label="Latest booking activity"
            head={["Booking", "Customer → Applicant", "Stage", "Status"]}
            rows={[...s.rows]
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 6)
              .map((r) => ({
                key: r.id,
                cells: [
                  <Link
                    key="b"
                    href={`/superadmin/payments/${r.id}`}
                    className="text-accent font-semibold hover:underline"
                  >
                    {r.ref}
                  </Link>,
                  <span key="p">
                    <Person name={r.customer.name} demo={r.customer.demo} /> → {r.applicant.name}
                  </span>,
                  STAGE[r.stage],
                  <Badge key="s" tone={PAY_STATUS[r.payStatus].tone}>
                    {PAY_STATUS[r.payStatus].label}
                  </Badge>,
                ],
              }))}
          />
        </Card>
      </div>

      <Card
        title="Recent transactions"
        action={
          <Link className="text-accent text-sm font-semibold hover:underline" href="/superadmin/transactions">
            All transactions
          </Link>
        }
      >
        <Table
          label="Recent transactions"
          head={["When", "Type", "Amount", "Booking", "Party", "Status"]}
          rows={s.txns.slice(0, 8).map((t) => ({
            key: t.id,
            cells: [
              npDate(t.at, "en", { time: true }),
              <Badge key="t" tone={TXN_TYPE[t.type].tone}>
                {TXN_TYPE[t.type].label}
              </Badge>,
              money(t.amount),
              t.bookingId ? (
                <Link key="b" href={`/superadmin/payments/${t.bookingId}`} className="hover:underline">
                  {t.bookingRef}
                </Link>
              ) : (
                "—"
              ),
              <Person key="p" name={t.party} demo={t.demo} />,
              t.to,
            ],
          }))}
        />
      </Card>
    </>
  );
}
