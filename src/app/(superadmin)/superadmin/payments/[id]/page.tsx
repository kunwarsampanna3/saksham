import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge, Card, KV, money, PageHeader, Person, Table } from "@/components/superadmin/ui";
import { ConfirmAction } from "@/components/superadmin/confirm-action";
import { requireSuperAdmin } from "@/lib/superadmin";
import { financeSnapshot, METHOD, PAY_STATUS, STAGE, TXN_TYPE, type BookingRow } from "@/lib/finance";
import { splitAdvance } from "@/lib/business";
import { store } from "@/lib/store";
import { npDate } from "@/lib/format";
import type { Booking } from "@/lib/store/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment details" };

const when = (iso?: string) => (iso ? npDate(iso, "en", { time: true }) : "—");

/** The 50 / 30 / 20 → 50 / 30 / 40 → 40 schedule, step by step, with the escrow balance after each step. */
function advanceSteps(b: Booking, r: BookingRow) {
  const s = splitAdvance(b.total);
  const by = Object.fromEntries(b.installments.map((i) => [i.label, i]));
  const secondPaid = by.half?.state === "released";
  const finish = by.finish;
  const refunded = b.status === "refunded";
  return [
    {
      key: "1",
      step: "1 · Hiring: customer pays 50%",
      paidIn: s.firstPayment,
      toApplicant: s.payouts.advance,
      held: s.pieces.kept,
      escrowAfter: s.pieces.kept,
      status: <Badge tone="good">Paid {when(by.advance?.releasedAt)}</Badge>,
    },
    {
      key: "2",
      step: "2 · Half done: customer pays 50%",
      paidIn: s.secondPayment,
      toApplicant: s.payouts.half,
      held: s.payouts.finish,
      escrowAfter: s.payouts.finish,
      note: `${money(s.pieces.kept)} held from step 1 + ${money(s.pieces.half)} of this payment = ${money(s.payouts.half)} (30%)`,
      status: secondPaid ? (
        <Badge tone="good">Paid {when(by.half?.releasedAt)}</Badge>
      ) : refunded ? (
        <Badge>Cancelled</Badge>
      ) : (
        <Badge tone="pending">
          {b.halfDoneAt ? "Waiting for the customer" : "Waiting for half-done report"}
        </Badge>
      ),
    },
    {
      key: "3",
      step: "3 · Customer approves the finished work",
      paidIn: 0,
      toApplicant: s.payouts.finish,
      held: 0,
      escrowAfter: 0,
      status:
        finish?.state === "released" ? (
          <Badge tone="good">Released {when(finish.releasedAt)}</Badge>
        ) : finish?.state === "refunded" ? (
          <Badge tone="bad">Refunded to customer</Badge>
        ) : refunded ? (
          <Badge>Cancelled</Badge>
        ) : finish?.state === "delivered" ? (
          <Badge tone="pending">Finished · waiting for approval</Badge>
        ) : (
          <Badge tone="pending">{finish?.state === "held" ? "Held · work in progress" : "Not reached"}</Badge>
        ),
    },
  ].map((x) => ({ ...x, hold: r.hold && x.key !== "1" }));
}

export default async function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSuperAdmin(`/superadmin/payments/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [b, s] = await Promise.all([store.getBooking(id), financeSnapshot()]);
  const r = s.rowById.get(id);
  if (!b || !r) notFound();
  const events = s.events.filter((e) => e.bookingId === id);
  const txns = s.txns.filter((t) => t.bookingId === id);
  const canHold = b.status === "active" || b.status === "disputed";
  const party = b.clientId === user.id || b.providerId === user.id;

  return (
    <>
      <Link
        href="/superadmin/payments"
        className="text-muted mb-3 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft size={15} aria-hidden /> Payment Management
      </Link>
      <PageHeader
        title={`Booking ${r.ref}`}
        lead={
          <>
            {r.title} · {r.category} {r.demo && <span className="demo-tag ml-1">Demo · simulated money</span>}
          </>
        }
      >
        <Badge tone={PAY_STATUS[r.payStatus].tone}>{PAY_STATUS[r.payStatus].label}</Badge>
        {canHold &&
          !party &&
          (r.hold ? (
            <ConfirmAction
              label="Lift hold"
              title="Lift the finance hold?"
              summary="Payments on this booking can continue under the normal milestone rules. Nothing is released by lifting the hold itself."
              body={{ action: "hold", bookingId: id, hold: false, reason: "" }}
              confirmLabel="Lift hold"
              small={false}
            />
          ) : (
            <ConfirmAction
              label={
                <>
                  <Lock size={15} aria-hidden /> Put on hold
                </>
              }
              title="Put this booking on hold?"
              summary={`While on hold, no money leaves escrow for ${r.applicant.name}: the customer can't release the final 40% or pay the 2nd 50%. ${money(r.held)} is held now. Both people are told.`}
              body={{ action: "hold", bookingId: id, hold: true }}
              needReason
              tone="danger"
              confirmLabel="Put on hold"
              small={false}
            />
          ))}
        {user.isAdmin && (
          <Link href={`/payments/${id}`} className="btn btn-ghost !min-h-10 text-sm">
            Open as customers see it
          </Link>
        )}
      </PageHeader>

      {r.hold && (
        <p className="mb-4 rounded-lg bg-[var(--bad-soft)] p-3 text-sm text-[var(--bad-text)]" role="status">
          <strong>On hold</strong> since {when(r.hold.at)} by {r.hold.byName}: {r.hold.reason}
        </p>
      )}

      <Card title="Summary">
        <KV
          items={[
            ["Customer", <Person key="c" name={r.customer.name} demo={r.customer.demo} />],
            [
              "Applicant",
              <Person
                key="a"
                name={r.applicant.name}
                demo={r.applicant.demo}
                href={r.applicant.account ? `/superadmin/applicants/${r.applicant.id}` : undefined}
              />,
            ],
            ["Total booking amount", money(r.total)],
            ["Received from customer", money(r.received)],
            ["Allocated to applicant", money(r.applicantAmount)],
            ["Released to applicant", money(r.released)],
            ["Held in escrow now", money(r.held)],
            ["Still to be paid by customer", money(r.remaining)],
            ["Refunded", money(r.refunded)],
            ["Milestone", STAGE[r.stage]],
            ["Payment method", METHOD[b.method] ?? b.method],
            ["Booked", when(b.createdAt)],
          ]}
        />
        <p className="text-muted mt-3 text-xs">
          {b.plan === "advance"
            ? "Saksham earns nothing from escrow. The 20% and then 40% held belong to the applicant; Saksham's 7% is taken only when the applicant withdraws."
            : `Earlier payment plan (${b.plan}): ${Math.round(b.feeRate * 100)}% is taken at each release.`}
        </p>
      </Card>

      <Card
        title="Payment distribution"
        lead="How each payment was split. Releases happen only when the milestone is reached."
      >
        {b.plan === "advance" ? (
          <Table
            label="Payment distribution"
            head={["Step", "Customer pays", "To applicant", "Held in escrow", "Escrow after", "Status"]}
            rows={advanceSteps(b, r).map((x) => ({
              key: x.key,
              cells: [
                <span key="s">
                  <span className="font-semibold">{x.step}</span>
                  {x.note && <span className="text-muted block text-xs">{x.note}</span>}
                  {x.hold && (
                    <span className="block text-xs font-semibold text-[var(--bad-text)]">
                      Blocked by finance hold
                    </span>
                  )}
                </span>,
                x.paidIn ? money(x.paidIn) : "—",
                money(x.toApplicant),
                x.held ? money(x.held) : "—",
                money(x.escrowAfter),
                x.status,
              ],
            }))}
          />
        ) : (
          <Table
            label="Installments"
            head={["#", "Part", "Amount", "State", "Paid in", "Released"]}
            rows={b.installments.map((i) => ({
              key: i.id,
              cells: [
                i.seq,
                `${i.label} (${i.pct}%)`,
                money(i.amount),
                i.state,
                when(i.heldAt),
                when(i.releasedAt),
              ],
            }))}
          />
        )}
      </Card>

      <Card
        title="Transaction history"
        lead="Every receipt for this booking, oldest first. Records are never edited."
      >
        <Table
          label="Transaction history"
          head={["Transaction ID", "When", "Type", "Amount", "From → To", "Responsible", "Reference"]}
          rows={[...txns].reverse().map((t) => ({
            key: t.id,
            cells: [
              <span key="id" className="font-mono text-xs">
                {t.id}
              </span>,
              when(t.at),
              <Badge key="t" tone={TXN_TYPE[t.type].tone}>
                {TXN_TYPE[t.type].label}
              </Badge>,
              money(t.amount),
              `${t.from} → ${t.to}`,
              t.admin,
              <span key="r" className="font-mono text-xs">
                {t.ref}
              </span>,
            ],
          }))}
        />
      </Card>

      <div className="grid min-w-0 gap-x-5 xl:grid-cols-2">
        <Card title="Finance team actions">
          <Table
            label="Finance team actions"
            empty="No team actions on this booking."
            head={["When", "Action", "By", "Reason"]}
            rows={events.map((e) => ({
              key: e.id,
              cells: [when(e.createdAt), e.action.replace(/_/g, " "), e.adminName, e.reason],
            }))}
          />
        </Card>
        <Card title="Disputes">
          <Table
            label="Disputes"
            empty="No disputes on this booking."
            head={["Opened", "By", "Wants", "Reason", "Status"]}
            rows={r.disputes.map((d) => ({
              key: d.id,
              cells: [
                when(d.createdAt),
                d.role === "client" ? "Customer" : "Applicant",
                d.wanted,
                d.reason,
                <Badge key="s" tone={d.status === "open" ? "bad" : "plain"}>
                  {d.resolution ?? d.status}
                </Badge>,
              ],
            }))}
          />
          {r.disputes.some((d) => d.status === "open") && (
            <Link
              href="/superadmin/disputes"
              className="text-accent mt-3 inline-block text-sm font-semibold hover:underline"
            >
              Resolve in Disputes
            </Link>
          )}
        </Card>
      </div>
    </>
  );
}
