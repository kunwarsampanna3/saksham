import Link from "next/link";
import { Badge, Card, money, PageHeader, Person, Table, Tabs } from "@/components/superadmin/ui";
import { ConfirmAction } from "@/components/superadmin/confirm-action";
import { requireSuperAdmin } from "@/lib/superadmin";
import { applicantSummary, financeSnapshot, METHOD, PAYOUT_STATUS, STAGE, param } from "@/lib/finance";
import { canSeePrivate } from "@/lib/admin";
import { maskPhone } from "@/lib/validation";
import { npDate } from "@/lib/format";
import { payoutReviewOn } from "@/lib/wallet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pending Releases" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Releases({ searchParams }: { searchParams: SP }) {
  const user = await requireSuperAdmin("/superadmin/releases");
  const v = param((await searchParams).view);
  const view = v === "escrow" || v === "decided" ? v : "payouts";
  const [s, review] = await Promise.all([financeSnapshot(), payoutReviewOn()]);

  const waiting = s.payoutRows.filter(
    (p) => p.payout.status === "requested" || p.payout.status === "on_hold",
  );
  const decided = s.payoutRows.filter((p) => p.payout.review);
  const escrow = s.rows.filter((r) => r.nextRelease && (r.status === "active" || r.status === "disputed"));

  return (
    <>
      <PageHeader
        title="Pending Releases"
        lead="Withdrawals waiting for your approval, and escrow money waiting for its milestone. Escrow is released only by the milestone itself (the customer's payment or approval); you can hold it, never release it early."
      />
      {!review && (
        <p className="mb-4 rounded-lg bg-[var(--pend-soft)] p-3 text-sm text-[var(--pend-text)]">
          Withdrawal review is off in Settings, so new withdrawals are sent at once without coming here.
        </p>
      )}
      <Tabs
        current={view}
        items={[
          {
            key: "payouts",
            label: "Withdrawal requests",
            href: "/superadmin/releases",
            count: waiting.length,
          },
          {
            key: "escrow",
            label: "Escrow by milestone",
            href: "/superadmin/releases?view=escrow",
            count: escrow.length,
          },
          {
            key: "decided",
            label: "Decided",
            href: "/superadmin/releases?view=decided",
            count: decided.length,
          },
        ]}
      />

      {view === "payouts" && (
        <Card
          title="Withdrawal requests"
          lead="The applicant's released earnings, going to their eSewa or Khalti. Approving sends it (sandbox). Rejecting returns the amount to their balance."
        >
          <Table
            label="Withdrawal requests"
            empty="No withdrawals are waiting."
            head={[
              "Applicant",
              "Payout ID",
              "Amount",
              "7% fee",
              "They receive",
              "Payment details",
              "Balance after",
              "Requested",
              "Status",
              "Actions",
            ]}
            rows={waiting.map((p) => {
              const a = applicantSummary(s, p.payout.userId);
              const own = p.payout.userId === user.id;
              const protectedAcct = p.user ? !canSeePrivate(user, p.user) : false;
              const why = own ? "Your own withdrawal" : protectedAcct ? "Real account: owner only" : null;
              const summary = (verb: string) => (
                <>
                  {verb} <strong>{money(p.net)}</strong> to <strong>{p.applicant.name}</strong> by{" "}
                  {METHOD[p.payout.method]} (withdrawal of {money(p.payout.amount)}, 7% fee{" "}
                  {money(p.payout.fee ?? 0)}). Payout {p.ref}.
                </>
              );
              return {
                key: p.payout.id,
                cells: [
                  <Person
                    key="a"
                    name={p.applicant.name}
                    demo={p.applicant.demo}
                    href={`/superadmin/applicants/${p.payout.userId}`}
                  />,
                  <span key="id" className="font-mono text-xs">
                    {p.ref}
                  </span>,
                  money(p.payout.amount),
                  money(p.payout.fee ?? 0),
                  <strong key="n">{money(p.net)}</strong>,
                  <span key="m">
                    {METHOD[p.payout.method]}
                    <span className="text-muted block text-xs">
                      {p.user && canSeePrivate(user, p.user)
                        ? p.user.phone || p.user.email
                        : maskPhone(p.user?.phone ?? "")}
                    </span>
                  </span>,
                  money(a.balance),
                  npDate(p.payout.createdAt, "en", { time: true }),
                  <span key="s">
                    <Badge tone={PAYOUT_STATUS[p.payout.status].tone}>
                      {PAYOUT_STATUS[p.payout.status].label}
                    </Badge>
                    {p.payout.status === "on_hold" && p.payout.review && (
                      <span className="text-muted block text-xs">
                        {p.payout.review.byName}: {p.payout.review.reason}
                      </span>
                    )}
                  </span>,
                  !why ? (
                    <div key="x" className="flex flex-wrap items-center gap-1.5">
                      <ConfirmAction
                        label="Approve"
                        title="Approve and send this withdrawal?"
                        summary={summary("Send")}
                        body={{ action: "payout", id: p.payout.id, decision: "approve", reason: "" }}
                        confirmLabel="Approve and send"
                      />
                      <ConfirmAction
                        label="Reject"
                        title="Reject this withdrawal?"
                        summary={
                          <>
                            Nothing is sent. {money(p.payout.amount)} goes back to {p.applicant.name}&apos;s
                            balance, and they see your reason.
                          </>
                        }
                        body={{ action: "payout", id: p.payout.id, decision: "reject" }}
                        needReason
                        tone="danger"
                        confirmLabel="Reject"
                      />
                      {p.payout.status === "requested" && (
                        <ConfirmAction
                          label="Hold"
                          title="Put this withdrawal on hold?"
                          summary="It stays reserved from the balance and isn't sent until someone approves or rejects it."
                          body={{ action: "payout", id: p.payout.id, decision: "hold" }}
                          needReason
                          tone="ghost"
                          confirmLabel="Put on hold"
                        />
                      )}
                      <Link
                        href={`/superadmin/transactions?q=${p.ref}`}
                        className="text-accent text-xs font-semibold hover:underline"
                      >
                        History
                      </Link>
                    </div>
                  ) : (
                    <span key="x" className="text-muted text-xs">
                      {why ?? "View only"}
                    </span>
                  ),
                ],
              };
            })}
          />
        </Card>
      )}

      {view === "escrow" && (
        <Card
          title="Escrow by milestone"
          lead="What each booking will release next, and who has to act. Holding a booking stops its next release."
        >
          <Table
            label="Escrow by milestone"
            empty="No booking has money waiting for a milestone."
            head={[
              "Applicant",
              "Booking ID",
              "Total job",
              "Eligible at next milestone",
              "Held now",
              "Milestone",
              "Customer approval",
              "Paid to",
              "Actions",
            ]}
            rows={escrow.map((r) => ({
              key: r.id,
              cells: [
                <Person
                  key="a"
                  name={r.applicant.name}
                  demo={r.applicant.demo}
                  href={r.applicant.account ? `/superadmin/applicants/${r.applicant.id}` : undefined}
                />,
                <span key="id" className="font-mono text-xs">
                  {r.ref}
                </span>,
                money(r.total),
                <span key="e">
                  {money(r.nextRelease!.amount)}
                  <span className="text-muted block text-xs">{r.nextRelease!.waitingFor}</span>
                </span>,
                money(r.held),
                STAGE[r.stage],
                r.stage === "delivered" ? (
                  <Badge key="c" tone="pending">
                    Waiting for approval
                  </Badge>
                ) : r.status === "disputed" ? (
                  <Badge key="c" tone="bad">
                    Disputed
                  </Badge>
                ) : (
                  <Badge key="c">Not yet asked</Badge>
                ),
                r.applicant.account ? "Saksham wallet → eSewa/Khalti" : "Example provider (demo)",
                <div key="x" className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/superadmin/payments/${r.id}`}
                    className="btn btn-ghost !min-h-9 !px-3 text-xs"
                  >
                    View
                  </Link>
                  {r.hold ? <Badge tone="bad">On hold</Badge> : null}
                  {!r.hold && (
                    <ConfirmAction
                      label="Hold"
                      title={`Put ${r.ref} on hold?`}
                      summary={`No money leaves escrow for ${r.applicant.name} until the hold is lifted. ${money(r.held)} is held now.`}
                      body={{ action: "hold", bookingId: r.id, hold: true }}
                      needReason
                      tone="danger"
                      confirmLabel="Put on hold"
                    />
                  )}
                  <button
                    type="button"
                    disabled
                    className="btn btn-ghost !min-h-9 !px-3 text-xs"
                    title="Released only by the customer's approval"
                  >
                    Approve release
                  </button>
                </div>,
              ],
            }))}
          />
          <p className="text-muted mt-3 text-xs">
            “Approve release” is switched off for escrow on purpose: under Saksham&apos;s milestone agreement
            only the customer&apos;s payment or approval releases it. A dispute is the way to settle it
            otherwise.
          </p>
        </Card>
      )}

      {view === "decided" && (
        <Card title="Decided withdrawals">
          <Table
            label="Decided withdrawals"
            empty="No decisions yet."
            head={["Decided", "Applicant", "Payout ID", "Amount", "Status", "By", "Reason"]}
            rows={decided.map((p) => ({
              key: p.payout.id,
              cells: [
                npDate(p.payout.review!.at, "en", { time: true }),
                <Person key="a" name={p.applicant.name} demo={p.applicant.demo} />,
                <span key="id" className="font-mono text-xs">
                  {p.ref}
                </span>,
                money(p.payout.amount),
                <Badge key="s" tone={PAYOUT_STATUS[p.payout.status].tone}>
                  {PAYOUT_STATUS[p.payout.status].label}
                </Badge>,
                p.payout.review!.byName,
                p.payout.review!.reason || "—",
              ],
            }))}
          />
        </Card>
      )}
    </>
  );
}
