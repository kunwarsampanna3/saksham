import Link from "next/link";
import { PageHead, Panel, Stats, DataTable, Tag } from "@/components/admin/ui";
import { Columns } from "@/components/admin/charts";
import { requireAdmin } from "@/lib/admin";
import { allPosts, creditQueue, moneyOverview } from "@/lib/admin-data";
import { getControls } from "@/lib/controls";
import { getDict } from "@/lib/i18n/server";
import { online } from "@/lib/presence";
import { store } from "@/lib/store";
import { trafficHistory } from "@/lib/traffic";
import { npDate, num, rs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const [admin, { t, lang }] = await Promise.all([requireAdmin(), getDict()]);
  const d = t.adminDash;
  const o = d.overview;
  const [money, posts, pending, reports, credit, days, controls] = await Promise.all([
    moneyOverview(),
    allPosts(),
    store.listPendingVerifications(),
    store.listReports(),
    creditQueue(admin),
    trafficHistory(14),
    getControls(),
  ]);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const today = days[days.length - 1];
  const newest = [...money.users].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const waiting = [
    [o.verify, pending.filter((v) => v.kind !== "phone").length, "/admin/moderation?tab=verify"],
    [
      o.reports,
      reports.filter((r) => r.status === "open" || r.status === "reviewing").length,
      "/admin/moderation?tab=reports",
    ],
    [
      o.disputes,
      money.bookings.filter((b) => b.status === "disputed").length,
      "/admin/moderation?tab=disputes",
    ],
    [o.credit, credit.filter((c) => c.status === "submitted_demo").length, "/admin/credit"],
  ] as const;
  const todo = waiting.filter(([, n]) => n > 0);
  const off = (["signups", "posting", "applying"] as const)
    .filter((k) => !controls[k])
    .map((k) => d.traffic.switches[k].t);
  if (controls.maintenance) off.push(d.traffic.switches.maintenance.t);

  return (
    <>
      <PageHead title={o.title} lead={o.lead} />
      {off.length > 0 && (
        <p role="status" className="bg-danger-soft text-danger mb-4 rounded-[6px] p-3 font-semibold">
          {o.paused}: {off.join(", ")}
        </p>
      )}
      <Stats
        items={[
          { label: o.online, value: num(online().length, lang) },
          { label: o.visitsToday, value: num(today.views, lang) },
          { label: o.visitorsToday, value: num(today.visitors.length, lang) },
          {
            label: o.users,
            value: num(money.users.length, lang),
            note: o.newUsers(num(money.users.filter((u) => u.createdAt > weekAgo).length, lang)),
          },
          { label: o.livePosts, value: num(posts.filter((p) => p.group === "live").length, lang) },
          {
            label: o.activeJobs,
            value: num(money.bookings.filter((b) => b.status === "active").length, lang),
          },
          { label: o.held, value: rs(money.held, lang) },
          { label: o.earned, value: rs(money.earned, lang) },
        ]}
      />

      <div className="grid gap-x-5 xl:grid-cols-2">
        <Panel title={o.attention}>
          {!todo.length ? (
            <p className="text-muted">{o.allClear}</p>
          ) : (
            <ul className="divide-line divide-y">
              {todo.map(([label, n, href]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="hover:text-accent flex justify-between gap-3 py-2.5 font-semibold"
                  >
                    {label} <span>{num(n, lang)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={d.nav.traffic}>
          <Columns
            title={d.traffic.byDay}
            head={[d.traffic.day, d.traffic.views]}
            tableLabel={d.table}
            empty={d.none}
            lang={lang}
            points={days.map((x) => ({
              key: x.day,
              label: npDate(x.day, lang, { year: false }),
              value: x.views,
            }))}
          />
        </Panel>
      </div>

      <Panel
        title={o.recentUsers}
        action={
          <Link href="/admin/users" className="text-accent text-sm font-semibold hover:underline">
            {o.seeAll}
          </Link>
        }
      >
        <DataTable
          empty={d.none}
          head={[d.users.name, d.users.roles, d.users.city, d.users.joined]}
          rows={newest.slice(0, 6).map((u) => ({
            key: u.id,
            cells: [
              <Link
                key="name"
                href={`/admin/users/${u.id}`}
                className="text-accent font-semibold hover:underline"
              >
                {u.name} {u.isDemo && <Tag>{d.users.demo}</Tag>}
              </Link>,
              u.roles.map((r) => d.users.roleNames[r]).join(", "),
              u.city,
              npDate(u.createdAt, lang),
            ],
          }))}
        />
      </Panel>
    </>
  );
}
