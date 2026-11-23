import Link from "next/link";
import { Badge, Card, money, PageHeader, Person, Table, Tabs } from "@/components/superadmin/ui";
import { ConfirmAction } from "@/components/superadmin/confirm-action";
import { requireSuperAdmin } from "@/lib/superadmin";
import { financeSnapshot, STAGE, param } from "@/lib/finance";
import { canSeePrivate } from "@/lib/admin";
import { npDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disputes" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Disputes({ searchParams }: { searchParams: SP }) {
  const user = await requireSuperAdmin("/superadmin/disputes");
  const view = param((await searchParams).view) === "resolved" ? "resolved" : "open";
  const s = await financeSnapshot();
  const items = s.rows.flatMap((r) => r.disputes.map((d) => ({ r, d })));
  const shown = items
    .filter(({ d }) => (view === "open" ? d.status === "open" : d.status !== "open"))
    .sort((a, b) => b.d.createdAt.localeCompare(a.d.createdAt));

  return (
    <>
      <PageHeader
        title="Disputes"
        lead="Check the booking's full payment history before deciding. A redo keeps the money where it is; a refund returns only what is still in escrow. Money already released is never clawed back."
      />
      <Tabs
        current={view}
        items={[
          {
            key: "open",
            label: "Open",
            href: "/superadmin/disputes",
            count: items.filter(({ d }) => d.status === "open").length,
          },
          {
            key: "resolved",
            label: "Resolved",
            href: "/superadmin/disputes?view=resolved",
            count: items.filter(({ d }) => d.status !== "open").length,
          },
        ]}
      />
      <Card>
        <Table
          label="Disputes"
          empty={view === "open" ? "No open disputes." : "No resolved disputes yet."}
          head={[
            "Opened",
            "Booking",
            "Opened by",
            "Wants",
            "Reason",
            "Milestone",
            "In escrow",
            "Released",
            ...(view === "open" ? ["Decision"] : ["Outcome"]),
          ]}
          rows={shown.map(({ r, d }) => {
            const party = r.customer.id === user.id || r.applicant.id === user.id;
            const owner = s.userById.get(r.customer.id);
            const blocked = party
              ? "You're part of this booking"
              : owner && !canSeePrivate(user, owner)
                ? "Real account: owner only"
                : null;
            return {
              key: d.id,
              cells: [
                npDate(d.createdAt, "en", { time: true }),
                <span key="b">
                  <Link
                    href={`/superadmin/payments/${r.id}`}
                    className="text-accent font-mono text-xs font-semibold hover:underline"
                  >
                    {r.ref}
                  </Link>
                  <span className="text-muted block text-xs">{r.title}</span>
                </span>,
                <span key="o">
                  <Person name={d.role === "client" ? r.customer.name : r.applicant.name} demo={r.demo} />
                  <span className="text-muted block text-xs">
                    {d.role === "client" ? "Customer" : "Applicant"}
                  </span>
                </span>,
                d.wanted === "refund" ? (
                  <Badge key="w" tone="bad">
                    Refund
                  </Badge>
                ) : (
                  <Badge key="w" tone="pending">
                    Redo
                  </Badge>
                ),
                d.reason,
                STAGE[r.stage],
                money(r.held),
                money(r.released),
                view === "open" ? (
                  !blocked ? (
                    <div key="x" className="flex flex-wrap gap-1.5">
                      <ConfirmAction
                        label="Arrange redo"
                        title="Resolve with a redo?"
                        summary={`The booking goes back to active. ${money(r.held)} stays in escrow and the milestone rules continue.`}
                        body={{ action: "dispute", bookingId: r.id, outcome: "redo" }}
                        confirmLabel="Arrange redo"
                      />
                      <ConfirmAction
                        label="Refund"
                        title="Refund the customer?"
                        summary={`${money(r.held)} still in escrow goes back to ${r.customer.name}. ${money(r.released)} already released to ${r.applicant.name} stays with them. The booking is closed.`}
                        body={{ action: "dispute", bookingId: r.id, outcome: "refund" }}
                        tone="danger"
                        confirmLabel="Refund held money"
                      />
                    </div>
                  ) : (
                    <span key="x" className="text-muted text-xs">
                      {blocked ?? "View only (Support or Super Admin decides)"}
                    </span>
                  )
                ) : (
                  <Badge key="x">{d.resolution ?? d.status}</Badge>
                ),
              ],
            };
          })}
        />
      </Card>
    </>
  );
}
