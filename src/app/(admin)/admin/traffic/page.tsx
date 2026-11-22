import Link from "next/link";
import { DataTable, PageHead, Panel, Stats } from "@/components/admin/ui";
import { Columns, Ranked } from "@/components/admin/charts";
import { ControlsForm } from "@/components/admin/manage";
import { requireAdmin } from "@/lib/admin";
import { getControls } from "@/lib/controls";
import { getDict } from "@/lib/i18n/server";
import { online } from "@/lib/presence";
import { store } from "@/lib/store";
import { trafficHistory } from "@/lib/traffic";
import { npDate, num } from "@/lib/format";

export const dynamic = "force-dynamic";
const RANGES = [7, 14, 30] as const;

export default async function AdminTraffic({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const [, { t, lang }, sp] = await Promise.all([requireAdmin("/admin/traffic"), getDict(), searchParams]);
  const d = t.adminDash;
  const x = d.traffic;
  const range = RANGES.find((r) => String(r) === sp.days) ?? 14;
  const [history, controls, users] = await Promise.all([
    trafficHistory(range),
    getControls(),
    store.listUsers(),
  ]);
  const here = online();
  const name = new Map(users.map((u) => [u.id, u.name]));

  const pages = new Map<string, number>();
  const hours = Array<number>(24).fill(0);
  for (const day of history) {
    for (const [p, n] of Object.entries(day.pages)) pages.set(p, (pages.get(p) ?? 0) + n);
    day.hours.forEach((n, h) => (hours[h] += n));
  }
  const total = (pick: (day: (typeof history)[number]) => number) =>
    history.reduce((n, day) => n + pick(day), 0);
  const dayLabel = (day: string) => npDate(day, lang, { year: false });

  return (
    <>
      <PageHead title={x.title} lead={x.lead}>
        <nav aria-label={x.title} className="flex flex-wrap gap-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/traffic?days=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${r === range ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}
            >
              {x.days(num(r, lang))}
            </Link>
          ))}
        </nav>
      </PageHead>
      <Stats
        items={[
          { label: x.online, value: num(here.length, lang) },
          {
            label: x.views,
            value: num(
              total((v) => v.views),
              lang,
            ),
          },
          {
            label: x.signedIn,
            value: num(
              total((v) => v.signedInViews),
              lang,
            ),
          },
          {
            label: x.mobile,
            value: num(
              total((v) => v.mobileViews),
              lang,
            ),
          },
          {
            label: x.blocked,
            value: num(
              total((v) => v.blocked),
              lang,
            ),
          },
        ]}
      />

      <div className="grid gap-x-5 xl:grid-cols-2">
        <Panel title={x.controls}>
          <ControlsForm key={controls.updatedAt ?? "first"} initial={controls} />
        </Panel>
        <Panel title={x.online} lead={x.onlineLead}>
          <DataTable
            empty={d.none}
            head={[d.users.name, x.page]}
            rows={here.slice(0, 50).map((v, i) => ({
              key: String(i),
              cells: [
                v.userId ? (
                  <Link key="who" href={`/admin/users/${v.userId}`} className="hover:underline">
                    {name.get(v.userId) ?? "—"}
                  </Link>
                ) : (
                  x.guest
                ),
                v.page,
              ],
            }))}
          />
        </Panel>
      </div>

      <Panel title={x.days(num(range, lang))} lead={x.privacy}>
        <div className="grid gap-8 xl:grid-cols-2">
          <Columns
            title={x.byDay}
            head={[x.day, x.views]}
            tableLabel={d.table}
            empty={d.none}
            lang={lang}
            points={history.map((v) => ({ key: v.day, label: dayLabel(v.day), value: v.views }))}
          />
          <Columns
            title={x.visitorsByDay}
            head={[x.day, x.visitors]}
            tableLabel={d.table}
            empty={d.none}
            lang={lang}
            points={history.map((v) => ({ key: v.day, label: dayLabel(v.day), value: v.visitors.length }))}
          />
          <Columns
            title={x.byHour}
            head={[x.hour, x.views]}
            tableLabel={d.table}
            empty={d.none}
            lang={lang}
            points={hours.map((value, h) => ({
              key: String(h),
              label: `${num(h, lang)}:${lang === "ne" ? "००" : "00"}`,
              value,
            }))}
          />
          <Ranked
            title={x.topPages}
            empty={d.none}
            lang={lang}
            points={[...pages]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([page, value]) => ({ key: page, label: page, value }))}
          />
        </div>
      </Panel>
    </>
  );
}
