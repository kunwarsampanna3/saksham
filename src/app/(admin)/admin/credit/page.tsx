import Link from "next/link";
import { DataTable, PageHead, Panel } from "@/components/admin/ui";
import { ManageButton } from "@/components/admin/manage";
import { requireAdmin } from "@/lib/admin";
import { creditQueue } from "@/lib/admin-data";
import { getDict } from "@/lib/i18n/server";
import { npDate, num, rs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCredit() {
  const [admin, { t, lang }] = await Promise.all([requireAdmin("/admin/credit"), getDict()]);
  const d = t.adminDash;
  const c = d.credit;
  const rows = await creditQueue(admin);
  return (
    <>
      <PageHead title={c.title} lead={c.lead} />
      <Panel title={t.credit.applications}>
        <DataTable
          empty={d.none}
          head={[
            d.users.name,
            c.as,
            c.amount,
            c.limit,
            c.months,
            c.purpose,
            d.money.status,
            d.money.date,
            "",
          ]}
          rows={rows.map((r) => ({
            key: r.id,
            cells: [
              <Link
                key="name"
                href={`/admin/users/${r.user.id}`}
                className="text-accent font-semibold hover:underline"
              >
                {r.user.name}
              </Link>,
              t.market.credit.tabs[r.kind ?? "applicant"],
              rs(r.amount, lang),
              rs(r.limitAtApply, lang),
              num(r.months, lang),
              r.visible ? r.purpose : d.users.hidden,
              t.market.credit.status[r.status],
              npDate(r.createdAt, lang),
              r.decidable ? (
                <span key="decide" className="flex gap-1.5">
                  <ManageButton
                    body={{ action: "credit", userId: r.user.id, id: r.id, approve: true }}
                    label={d.actions.approve}
                  />
                  <ManageButton
                    body={{ action: "credit", userId: r.user.id, id: r.id, approve: false }}
                    label={d.actions.decline}
                    danger
                  />
                </span>
              ) : (
                ""
              ),
            ],
          }))}
        />
      </Panel>
    </>
  );
}
