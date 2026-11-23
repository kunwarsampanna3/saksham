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
import { customerSummary, financeSnapshot, param } from "@/lib/finance";
import { contactOf } from "@/lib/admin";
import { npDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer Management" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Customers({ searchParams }: { searchParams: SP }) {
  const me = await requireSuperAdmin("/superadmin/customers");
  const q = param((await searchParams).q)
    .trim()
    .toLowerCase()
    .slice(0, 80);
  const s = await financeSnapshot();
  const people = s.users
    .filter((u) => u.roles.includes("client"))
    .filter((u) => !q || `${u.name} ${u.city}`.toLowerCase().includes(q))
    .map((u) => ({ u, c: customerSummary(s, u.id), contact: contactOf(me, u) }))
    .sort((x, y) => y.c.paid - x.c.paid || x.u.name.localeCompare(y.u.name));

  return (
    <>
      <PageHeader
        title="Customer Management"
        lead="People who hire on Saksham: their bookings, payments, escrow and complaints."
      />
      <FilterBar reset="/superadmin/customers">
        <Field label="Name or city">
          <input name="q" defaultValue={q} className={`${inputCls} w-64`} />
        </Field>
      </FilterBar>
      <Card title={`${people.length} customer${people.length === 1 ? "" : "s"}`}>
        <Table
          label="Customers"
          empty="No customers match."
          head={[
            "Customer",
            "Contact",
            "Bookings",
            "Paid for bookings",
            "In escrow",
            "Refunded",
            "Posting fees",
            "Disputes",
            "Joined",
          ]}
          rows={people.map(({ u, c, contact }) => ({
            key: u.id,
            cells: [
              <span key="n">
                <Person name={u.name} demo={u.isDemo} />
                <span className="text-muted block text-xs">
                  {u.city}
                  {u.suspended ? " · Suspended" : ""}
                </span>
              </span>,
              <span key="c" className="text-xs">
                {contact.phone || contact.email || "—"}
              </span>,
              c.bookings.length,
              money(c.paid),
              money(c.inEscrow),
              money(c.refunded),
              money(c.postFees),
              c.disputes ? (
                <Badge key="d" tone="bad">
                  {c.disputes}
                </Badge>
              ) : (
                "0"
              ),
              npDate(u.createdAt, "en", { year: true }),
            ],
          }))}
        />
      </Card>
    </>
  );
}
