import Link from "next/link";
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
import { applicantSummary, financeSnapshot, param } from "@/lib/finance";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applicant Management" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Applicants({ searchParams }: { searchParams: SP }) {
  await requireSuperAdmin("/superadmin/applicants");
  const sp = await searchParams;
  const q = param(sp.q).trim().toLowerCase().slice(0, 80);
  const show = param(sp.show);
  const s = await financeSnapshot();

  const people = await Promise.all(
    s.users
      .filter((u) => u.roles.includes("provider"))
      .filter((u) => !q || `${u.name} ${u.city}`.toLowerCase().includes(q))
      .filter((u) => (show === "verified" ? u.verified : show === "unverified" ? !u.verified : true))
      .map(async (u) => ({ u, a: applicantSummary(s, u.id), ratings: await store.listRatingsFor(u.id) })),
  );
  people.sort((x, y) => y.a.earnings - x.a.earnings || x.u.name.localeCompare(y.u.name));

  return (
    <>
      <PageHeader
        title="Applicant Management"
        lead="People who offer their skills on Saksham: verification, bookings, earnings and what is still owed to them."
      />
      <FilterBar reset="/superadmin/applicants">
        <Field label="Name or city">
          <input name="q" defaultValue={q} className={`${inputCls} w-64`} />
        </Field>
        <Field label="Verification">
          <select name="show" defaultValue={show} className={inputCls}>
            <option value="">All</option>
            <option value="verified">Verified</option>
            <option value="unverified">Not verified</option>
          </select>
        </Field>
      </FilterBar>
      <Card title={`${people.length} applicant${people.length === 1 ? "" : "s"}`}>
        <Table
          label="Applicants"
          empty="No applicants match."
          head={[
            "Applicant",
            "Verification",
            "Active",
            "Completed",
            "Total earnings",
            "Received",
            "Pending",
            "Rating",
            "",
          ]}
          rows={people.map(({ u, a, ratings }) => ({
            key: u.id,
            cells: [
              <span key="n">
                <Person name={u.name} demo={u.isDemo} href={`/superadmin/applicants/${u.id}`} />
                <span className="text-muted block text-xs">
                  {u.city}
                  {u.womenLed ? " · Women-led" : ""}
                  {u.suspended ? " · Suspended" : ""}
                </span>
              </span>,
              u.verified ? (
                <Badge key="v" tone="good">
                  Verified
                </Badge>
              ) : (
                <Badge key="v" tone="pending">
                  Not verified
                </Badge>
              ),
              a.active,
              a.completed,
              money(a.earnings),
              money(a.received),
              money(a.inEscrow + a.awaitingPayout),
              ratings.length
                ? `${(ratings.reduce((n, r) => n + r.stars, 0) / ratings.length).toFixed(1)} ★ (${ratings.length})`
                : "—",
              <Link
                key="v2"
                href={`/superadmin/applicants/${u.id}`}
                className="btn btn-ghost !min-h-9 !px-3 text-xs"
              >
                View
              </Link>,
            ],
          }))}
        />
      </Card>
    </>
  );
}
