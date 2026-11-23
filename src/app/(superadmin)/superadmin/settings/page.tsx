import { Badge, Card, KV, PageHeader, Table } from "@/components/superadmin/ui";
import { ConfirmAction } from "@/components/superadmin/confirm-action";
import { requireSuperAdmin } from "@/lib/superadmin";
import { payoutReviewOn } from "@/lib/wallet";
import { config } from "@/lib/config";
import { store, storeKind } from "@/lib/store";
import { npDate } from "@/lib/format";
import { ADVANCE, MIN_WITHDRAW, POST_PLANS, WITHDRAW_FEE_RATE } from "@/lib/business";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requireSuperAdmin("/superadmin/settings");
  const [review, audit, events] = await Promise.all([
    payoutReviewOn(),
    store.listAudit(),
    store.listFinanceEvents(),
  ]);
  const log = [
    ...events.map((e) => ({
      id: e.id,
      at: e.createdAt,
      who: e.adminName,
      what: e.action.replace(/_/g, " "),
      detail: `${e.from} → ${e.to} · ${e.reason}`,
    })),
    ...audit
      .filter((a) => a.action === "finance_export" || a.action === "controls")
      .map((a) => ({
        id: a.id,
        at: a.createdAt,
        who: a.adminName,
        what: a.action.replace(/_/g, " "),
        detail: [a.target, a.detail].filter(Boolean).join(" · "),
      })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 100);
  const locked = config.publicDemo && user.isDemo;

  return (
    <>
      <PageHeader title="Settings" lead="How money leaves Saksham, and the rules the dashboard follows." />

      <Card
        title="Review withdrawals before sending"
        lead="On: an applicant's withdrawal waits in Pending Releases until the Super Admin approves it. Off: it is sent at once, as before."
        action={review ? <Badge tone="good">On</Badge> : <Badge tone="pending">Off</Badge>}
      >
        {locked ? (
          <p className="text-muted text-sm">Site settings can&apos;t be changed on the open public demo.</p>
        ) : (
          <ConfirmAction
            label={review ? "Turn off review" : "Turn on review"}
            title={review ? "Send withdrawals without review?" : "Review every withdrawal?"}
            summary={
              review
                ? "New withdrawals will be sent at once. Ones already waiting stay in Pending Releases until someone decides."
                : "New withdrawals will wait for the Super Admin to approve them."
            }
            body={{ action: "settings", payoutReview: !review }}
            confirmLabel="Save"
            tone={review ? "danger" : "primary"}
            money={false}
            small={false}
          />
        )}
      </Card>

      <Card
        title="Payment rules"
        lead="Fixed in code (src/lib/business.ts). Shown here for reference; the dashboard never changes them."
      >
        <KV
          items={[
            [
              "Hiring",
              `Customer pays ${ADVANCE.recruiterPct}% · applicant gets ${ADVANCE.startPct}% · ${ADVANCE.recruiterPct - ADVANCE.startPct}% held`,
            ],
            [
              "Half done",
              `Customer pays ${100 - ADVANCE.recruiterPct}% · applicant gets ${ADVANCE.halfPct}% · ${ADVANCE.finishPct}% held`,
            ],
            ["Customer approves", `Applicant gets the last ${ADVANCE.finishPct}%`],
            ["Saksham fee", `${Math.round(WITHDRAW_FEE_RATE * 100)}% of what an applicant withdraws`],
            ["Smallest withdrawal", `Rs. ${MIN_WITHDRAW}`],
            [
              "Posting",
              POST_PLANS.map((p) => `${p.days} days Rs. ${p.fee.toLocaleString("en-IN")}`).join(" · "),
            ],
            ["Escrow counted as revenue", "Never"],
          ]}
        />
      </Card>

      <Card title="Environment">
        <KV
          items={[
            ["Data store", storeKind === "supabase" ? "Supabase" : "Local file (.data/db.json)"],
            ["Demo mode", config.demoMode ? "On: simulated money, demo accounts" : "Off"],
            ["Payments", "Sandbox: no real money moves in this build"],
          ]}
        />
      </Card>

      {config.demoMode && (
        <Card
          title="Sample bookings (demo)"
          lead="Adds 9 sample bookings between demo accounts at different milestones (completed, waiting for approval, disputed and more) plus 3 withdrawal requests. They use the real escrow rules with sandbox money and are removed by Admin → Reset demo."
        >
          <ConfirmAction
            label="Add sample bookings"
            title="Add sample bookings?"
            summary="Demo accounts get sample bookings, payments and notifications. Nothing real is touched."
            body={{ action: "seed" }}
            confirmLabel="Add samples"
            money={false}
            small={false}
          />
        </Card>
      )}
      <Card
        title="Audit log"
        lead="Every finance action, export and settings change. Entries are never edited."
      >
        <Table
          label="Audit log"
          empty="Nothing yet."
          head={["When", "Who", "Action", "Detail"]}
          rows={log.map((l) => ({
            key: l.id,
            cells: [npDate(l.at, "en", { time: true }), l.who, l.what, l.detail],
          }))}
        />
      </Card>
    </>
  );
}
