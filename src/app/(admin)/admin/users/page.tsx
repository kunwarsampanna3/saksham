import Link from "next/link";
import { DataTable, PageHead, Panel, Tag } from "@/components/admin/ui";
import { contactOf, requireAdmin } from "@/lib/admin";
import { filterUsers, USER_FILTERS } from "@/lib/admin-data";
import { getDict } from "@/lib/i18n/server";
import { online } from "@/lib/presence";
import { store } from "@/lib/store";
import { npDate, num } from "@/lib/format";

export const dynamic = "force-dynamic";
const PER_PAGE = 25;

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [admin, { t, lang }, sp] = await Promise.all([requireAdmin("/admin/users"), getDict(), searchParams]);
  const d = t.adminDash;
  const u = d.users;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const show = USER_FILTERS.find((f) => f === sp.show) ?? "all";

  const [users, tasks, jobs, bookings] = await Promise.all([
    store.listUsers(),
    store.listTasks(),
    store.listAbroadJobs(),
    store.listBookings(),
  ]);
  const found = filterUsers(admin, users, q, show);
  const pages = Math.max(1, Math.ceil(found.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const here = new Set(online().map((x) => x.userId));

  const posted = new Map<string, number>();
  for (const x of [...tasks.filter((x) => !x.abroad), ...jobs])
    if (x.clientId) posted.set(x.clientId, (posted.get(x.clientId) ?? 0) + 1);
  const taken = new Map<string, number>();
  for (const b of bookings) taken.set(b.providerId, (taken.get(b.providerId) ?? 0) + 1);
  const to = (n: number) => `/admin/users?${new URLSearchParams({ q, show, page: String(n) })}`;

  return (
    <>
      <PageHead title={u.title} lead={u.lead} />
      {/* A GET form. Only what the admin types is in the address, never anyone's records. */}
      <form className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 basis-64">
          <span className="field-label">{u.search}</span>
          <input name="q" className="input" defaultValue={q} />
        </label>
        <label>
          <span className="field-label">{u.show}</span>
          <select name="show" className="input" defaultValue={show}>
            {USER_FILTERS.map((f) => (
              <option key={f} value={f}>
                {u.filters[f]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn btn-primary">
          {u.go}
        </button>
      </form>

      <Panel title={u.count(num(found.length, lang))}>
        <DataTable
          empty={d.none}
          head={[u.name, u.contact, u.roles, u.city, u.status, u.posted, u.working, u.joined]}
          rows={found.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(({ user: x }) => {
            const c = contactOf(admin, x);
            return {
              key: x.id,
              cells: [
                <Link
                  key="name"
                  href={`/admin/users/${x.id}`}
                  className="text-accent font-semibold hover:underline"
                >
                  {x.name}
                </Link>,
                <span key="contact" title={c.masked ? u.hidden : undefined}>
                  {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                </span>,
                x.roles.map((r) => u.roleNames[r]).join(", "),
                x.city,
                <span key="status">
                  {x.suspended ? <Tag tone="bad">{u.suspended}</Tag> : null}
                  {x.verified ? <Tag tone="good">{u.verified}</Tag> : <Tag>{u.unverified}</Tag>}
                  {x.isAdmin && <Tag>{u.admin}</Tag>}
                  {x.isDemo && <Tag>{u.demo}</Tag>}
                  {here.has(x.id) && <Tag tone="good">{u.online}</Tag>}
                </span>,
                num(posted.get(x.id) ?? 0, lang),
                num(taken.get(x.id) ?? 0, lang),
                npDate(x.createdAt, lang),
              ],
            };
          })}
        />
        {pages > 1 && (
          <nav aria-label={u.title} className="mt-3 flex items-center gap-2 text-sm">
            {page > 1 && (
              <Link href={to(page - 1)} className="btn btn-ghost !min-h-9">
                {u.prev}
              </Link>
            )}
            <span>{u.page(num(page, lang), num(pages, lang))}</span>
            {page < pages && (
              <Link href={to(page + 1)} className="btn btn-ghost !min-h-9">
                {u.next}
              </Link>
            )}
          </nav>
        )}
      </Panel>
    </>
  );
}
