import Link from "next/link";
import { DataTable, PageHead, Panel, Stats } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { moneyOverview, paidIn, sumPieces } from "@/lib/admin-data";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { npDate, rs } from "@/lib/format";

export const dynamic = "force-dynamic";
const SHOWN = 100;

export default async function AdminMoney() {
  const [, { t, lang }] = await Promise.all([requireAdmin("/admin/money"), getDict()]);
  const d = t.adminDash;
  const m = d.money;
  const [x, tasks] = await Promise.all([moneyOverview(), store.listTasks()]);
  const title = new Map(tasks.map((task) => [task.id, task.title]));
  const name = new Map(x.users.map((u) => [u.id, u.name]));
  const person = (id: string | null, fallback = "—") =>
    id && name.has(id) ? (
      <Link key={id} href={`/admin/users/${id}`} className="hover:underline">
        {name.get(id)}
      </Link>
    ) : (
      fallback
    );

  return (
    <>
      <PageHead title={m.title} lead={m.lead} />
      <Stats
        items={[
          { label: m.earned, value: rs(x.earned, lang) },
          { label: m.postFees, value: rs(x.postFees, lang) },
          { label: m.withdrawFees, value: rs(x.withdrawFees, lang) },
          { label: m.releaseFees, value: rs(x.releaseFees, lang) },
          { label: m.held, value: rs(x.held, lang) },
          { label: m.owedSecond, value: rs(x.toCome, lang) },
          { label: m.due, value: rs(x.inWallets, lang) },
          { label: m.refunded, value: rs(x.refunded, lang) },
        ]}
      />
      <Panel title={m.bookings}>
        <DataTable
          empty={d.none}
          head={[m.job, m.recruiter, m.applicant, m.total, m.paidIn, m.paidOut, m.held, m.status]}
          rows={x.bookings.slice(0, SHOWN).map((b) => ({
            key: b.id,
            cells: [
              <Link
                key="job"
                href={`/payments/${b.id}`}
                className="text-accent font-semibold hover:underline"
              >
                {title.get(b.taskId) ?? "—"}
              </Link>,
              person(b.clientId),
              person(b.providerId, b.providerName),
              rs(b.total, lang),
              rs(paidIn(b), lang),
              rs(sumPieces([b], "released"), lang),
              rs(sumPieces([b], "held", "delivered"), lang),
              m.bookingStates[b.status],
            ],
          }))}
        />
      </Panel>
      <Panel title={m.posting}>
        <DataTable
          empty={d.none}
          head={[m.job, m.recruiter, m.fee, t.receipt.no, m.date]}
          rows={x.posting.slice(0, SHOWN).map((p) => ({
            key: p.id,
            cells: [
              p.title,
              person(p.clientId, p.clientName),
              rs(p.post.fee, lang),
              p.post.receiptNo,
              npDate(p.post.paidAt, lang, { time: true }),
            ],
          }))}
        />
      </Panel>
      <Panel title={m.payouts}>
        <DataTable
          empty={d.none}
          head={[m.user, m.amount, m.fee, m.received, m.date]}
          rows={x.payouts.slice(0, SHOWN).map((p) => ({
            key: p.id,
            cells: [
              person(p.userId),
              rs(p.amount, lang),
              rs(p.fee ?? 0, lang),
              rs(p.amount - (p.fee ?? 0), lang),
              npDate(p.createdAt, lang, { time: true }),
            ],
          }))}
        />
      </Panel>
    </>
  );
}
