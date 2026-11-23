import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  Badge,
  Card,
  KV,
  money,
  PageHeader,
  Person,
  StatCard,
  StatGrid,
  Table,
} from "@/components/superadmin/ui";
import { requireSuperAdmin } from "@/lib/superadmin";
import {
  applicantSummary,
  categoryName,
  financeSnapshot,
  METHOD,
  PAY_STATUS,
  PAYOUT_STATUS,
  STAGE,
} from "@/lib/finance";
import { contactOf } from "@/lib/admin";
import { store } from "@/lib/store";
import { npDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applicant" };

const when = (iso: string) => npDate(iso, "en", { time: true });

export default async function Applicant({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireSuperAdmin(`/superadmin/applicants/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [u, s] = await Promise.all([store.getUserById(id), financeSnapshot()]);
  if (!u || !u.roles.includes("provider")) notFound();
  const [ratings, verifications] = await Promise.all([
    store.listRatingsFor(u.id),
    store.listVerifications(u.id),
  ]);
  const a = applicantSummary(s, u.id);
  // Support sees the profile and bookings; contact details follow the same rule as /admin.
  const contact = contactOf(me, u);
  const avg = ratings.length ? ratings.reduce((n, r) => n + r.stars, 0) / ratings.length : 0;

  return (
    <>
      <Link
        href="/superadmin/applicants"
        className="text-muted mb-3 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft size={15} aria-hidden /> Applicant Management
      </Link>
      <PageHeader
        title={u.name}
        lead={
          <>
            {u.headline ?? "Applicant"} · {u.city}{" "}
            {u.isDemo && <span className="demo-tag ml-1">Demo account</span>}
          </>
        }
      >
        {u.verified ? <Badge tone="good">Verified</Badge> : <Badge tone="pending">Not verified</Badge>}
        {u.womenLed && <Badge tone="good">Women-led group</Badge>}
        {u.suspended && <Badge tone="bad">Suspended</Badge>}
      </PageHeader>

      <StatGrid>
        <StatCard label="Active bookings" value={a.active} tone="pending" />
        <StatCard label="Completed bookings" value={a.completed} tone="good" />
        <StatCard
          label="Total earnings"
          value={money(a.earnings)}
          note="Released from escrow, before the 7%"
          tone="good"
        />
        <StatCard
          label="Received in their account"
          value={money(a.received)}
          note="Withdrawals sent, after the 7%"
          tone="good"
        />
        <StatCard
          label="Pending payments"
          value={money(a.inEscrow + a.awaitingPayout)}
          note={`${money(a.inEscrow)} in escrow · ${money(a.awaitingPayout)} withdrawal waiting`}
          tone="pending"
        />
        <StatCard label="Wallet balance" value={money(a.balance)} note="Released, not yet withdrawn" />
        <StatCard
          label="Rating"
          value={ratings.length ? `${avg.toFixed(1)} ★` : "—"}
          note={`${ratings.length} review${ratings.length === 1 ? "" : "s"}`}
        />
      </StatGrid>

      <Card title="Profile">
        <KV
          items={[
            ["Phone", contact.phone || "—"],
            ["Email", contact.email || "—"],
            ["Member since", npDate(u.createdAt, "en", { year: true })],
            ["Skills", (u.categories ?? []).map(categoryName).join(", ") || "—"],
            ["Service radius", u.radiusKm ? `${u.radiusKm} km` : "—"],
            [
              "Verification",
              verifications.length
                ? verifications
                    .map((v) => `${v.kind}: ${v.status}${v.simulated ? " (simulated)" : ""}`)
                    .join(" · ")
                : "Not started",
            ],
          ]}
        />
        {contact.masked && (
          <p className="text-muted mt-2 text-xs">
            Contacts are masked: the demo admin can&apos;t see real accounts&apos; details.
          </p>
        )}
      </Card>

      <Card title="Bookings">
        <Table
          label="Bookings"
          empty="No bookings yet."
          head={["Booking", "Customer", "Job", "Stage", "Total", "Released", "Held", "Status"]}
          rows={a.bookings.map((r) => ({
            key: r.id,
            cells: [
              <Link
                key="b"
                href={`/superadmin/payments/${r.id}`}
                className="text-accent font-mono text-xs font-semibold hover:underline"
              >
                {r.ref}
              </Link>,
              <Person key="c" name={r.customer.name} demo={r.customer.demo} />,
              r.title,
              STAGE[r.stage],
              money(r.total),
              money(r.released),
              money(r.held),
              <Badge key="s" tone={PAY_STATUS[r.payStatus].tone}>
                {PAY_STATUS[r.payStatus].label}
              </Badge>,
            ],
          }))}
        />
      </Card>

      <Card title="Payment history" lead="Withdrawals to their eSewa or Khalti">
        <Table
          label="Payment history"
          empty="No withdrawals yet."
          head={["Requested", "Payout ID", "Amount", "7% fee", "Received", "Method", "Status", "Decided by"]}
          rows={a.payouts.map((p) => ({
            key: p.payout.id,
            cells: [
              when(p.payout.createdAt),
              <span key="id" className="font-mono text-xs">
                {p.ref}
              </span>,
              money(p.payout.amount),
              money(p.payout.fee ?? 0),
              money(p.net),
              METHOD[p.payout.method],
              <Badge key="s" tone={PAYOUT_STATUS[p.payout.status].tone}>
                {PAYOUT_STATUS[p.payout.status].label}
              </Badge>,
              p.payout.review
                ? `${p.payout.review.byName}${p.payout.review.reason ? `: ${p.payout.review.reason}` : ""}`
                : "—",
            ],
          }))}
        />
      </Card>

      <Card title="Ratings and reviews">
        <Table
          label="Ratings and reviews"
          empty="No reviews yet."
          head={["When", "Stars", "Review"]}
          rows={[...ratings]
            .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
            .map((r) => ({ key: r.id, cells: [when(r.createdAt), "★".repeat(r.stars), r.text || "—"] }))}
        />
      </Card>
    </>
  );
}
