import { DataTable, PageHead, Panel } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { npDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminActivity() {
  const [, { t, lang }] = await Promise.all([requireAdmin("/admin/activity"), getDict()]);
  const d = t.adminDash;
  const a = d.activity;
  const names: Record<string, string> = a.actions;
  return (
    <>
      <PageHead title={a.title} lead={a.lead} />
      <Panel title={a.title}>
        <DataTable
          empty={d.none}
          head={[a.when, a.who, a.what, a.target, a.detail]}
          rows={[...(await store.listAudit())].reverse().map((e) => ({
            key: e.id,
            cells: [
              npDate(e.createdAt, lang, { time: true }),
              e.adminName,
              names[e.action] ?? e.action,
              e.target || "—",
              e.detail || "—",
            ],
          }))}
        />
      </Panel>
    </>
  );
}
