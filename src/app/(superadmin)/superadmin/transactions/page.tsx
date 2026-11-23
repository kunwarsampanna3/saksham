import Link from "next/link";
import { Download } from "lucide-react";
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
} from "@/components/superadmin/ui";
import { requireSuperAdmin } from "@/lib/superadmin";
import { DAY_RE, financeSnapshot, inDateRange, param, TXN_TYPE, type TxnType } from "@/lib/finance";
import { npDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Transactions" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const SHOWN = 300;

export default async function Transactions({ searchParams }: { searchParams: SP }) {
  await requireSuperAdmin("/superadmin/transactions");
  const sp = await searchParams;
  const q = param(sp.q).trim().toLowerCase().slice(0, 80);
  const type = param(sp.type) as TxnType | "";
  const from = DAY_RE.test(param(sp.from)) ? param(sp.from) : "";
  const to = DAY_RE.test(param(sp.to)) ? param(sp.to) : "";
  const s = await financeSnapshot();
  const rows = s.txns
    .filter((t) => !type || t.type === type)
    .filter((t) => inDateRange(t.at, from || undefined, to || undefined))
    .filter(
      (t) =>
        !q ||
        [t.id, t.bookingRef ?? "", t.bookingId ?? "", t.party, t.ref, t.note].some((x) =>
          x.toLowerCase().includes(q),
        ),
    );
  const total = rows.reduce((n, t) => n + t.amount, 0);
  const qs = new URLSearchParams({ kind: "transactions", ...(from && { from }), ...(to && { to }) });

  return (
    <>
      <PageHeader
        title="Transactions"
        lead="Every money movement: customer payments, escrow deposits and releases, payouts, refunds, failures and platform fees. Built from the original receipts, which are never edited."
      >
        <a href={`/api/superadmin/export?${qs}`} className="btn btn-ghost !min-h-10 text-sm">
          <Download size={16} aria-hidden /> Download CSV
        </a>
      </PageHeader>
      <FilterBar reset="/superadmin/transactions">
        <Field label="ID, booking, person or reference">
          <input name="q" defaultValue={q} className={`${inputCls} w-64`} />
        </Field>
        <Field label="Type">
          <select name="type" defaultValue={type} className={inputCls}>
            <option value="">All</option>
            {(Object.keys(TXN_TYPE) as TxnType[]).map((k) => (
              <option key={k} value={k}>
                {TXN_TYPE[k].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From">
          <input type="date" name="from" defaultValue={from} className={inputCls} />
        </Field>
        <Field label="To">
          <input type="date" name="to" defaultValue={to} className={inputCls} />
        </Field>
      </FilterBar>
      <Card
        title={`${rows.length} transaction${rows.length === 1 ? "" : "s"}`}
        lead={
          rows.length > SHOWN
            ? `Showing the newest ${SHOWN}. The CSV has all of them.`
            : `Sum of amounts shown: ${money(total)}`
        }
      >
        <Table
          label="Transactions"
          empty="No transactions match."
          head={[
            "Transaction ID",
            "Date and time",
            "Type",
            "Amount",
            "Booking",
            "Party",
            "Previous status",
            "Current status",
            "Responsible",
            "Reference",
          ]}
          rows={rows.slice(0, SHOWN).map((t) => ({
            key: t.id,
            cells: [
              <span key="id" className="font-mono text-xs">
                {t.id}
              </span>,
              npDate(t.at, "en", { time: true }),
              <Badge key="t" tone={TXN_TYPE[t.type].tone}>
                {TXN_TYPE[t.type].label}
              </Badge>,
              <strong key="a">{money(t.amount)}</strong>,
              t.bookingId ? (
                <Link
                  key="b"
                  href={`/superadmin/payments/${t.bookingId}`}
                  className="text-accent font-mono text-xs hover:underline"
                >
                  {t.bookingRef}
                </Link>
              ) : (
                "—"
              ),
              <Person key="p" name={t.party} demo={t.demo} />,
              t.from,
              t.to,
              t.admin,
              <span key="r" className="font-mono text-xs" title={t.note}>
                {t.ref}
              </span>,
            ],
          }))}
        />
      </Card>
    </>
  );
}
