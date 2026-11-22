import { AdminView, type AdminData, type Tab } from "@/components/admin/admin-view";
import { PageHead } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { config } from "@/lib/config";
import { CATEGORIES } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const TABS: Tab[] = ["verify", "reports", "disputes", "prices", "demo"];

/** Trust & safety: verifications, reports, disputes, the price table and the demo reset. */
export default async function Moderation({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [, { t }, sp] = await Promise.all([requireAdmin("/admin/moderation"), getDict(), searchParams]);
  const initial = TABS.find((x) => x === sp.tab);

  const name = async (id?: string | null) => (id ? ((await store.getUserById(id))?.name ?? "—") : "—");
  const [pending, reports, bookings, overrides] = await Promise.all([
    store.listPendingVerifications(),
    store.listReports(),
    store.listBookings(),
    store.listPriceOverrides(),
  ]);

  const disputes = (
    await Promise.all(
      bookings.map(async (b) => {
        const d = (await store.listDisputes(b.id)).find((x) => x.status === "open");
        if (!d) return null;
        const task = await store.getTask(b.taskId);
        return {
          id: d.id,
          bookingId: b.id,
          taskTitle: task?.title ?? "—",
          openedBy: await name(d.openedBy),
          role: d.role,
          reason: d.reason,
          wanted: d.wanted,
          createdAt: d.createdAt,
          clientName: await name(b.clientId),
          providerName: b.providerName,
        };
      }),
    )
  ).filter((x) => x !== null);

  const data: AdminData = {
    demoMode: config.demoMode,
    verifications: await Promise.all(
      pending
        .flatMap((v) => (v.kind === "phone" ? [] : [{ ...v, kind: v.kind }]))
        .map(async (v) => ({
          id: v.id,
          userId: v.userId,
          userName: await name(v.userId),
          kind: v.kind,
          submittedAt: v.submittedAt ?? "",
          fields: v.fields,
          files: v.files.map((f) => ({ id: f.id, label: f.label, mime: f.mime })),
        })),
    ),
    reports: await Promise.all(
      reports
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(async (r) => ({
          id: r.id,
          reason: r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt,
          reporter: await name(r.reporterId),
          target: r.targetUserId ? await name(r.targetUserId) : null,
          taskTitle: r.targetTaskId ? ((await store.getTask(r.targetTaskId))?.title ?? null) : null,
        })),
    ),
    disputes,
    prices: CATEGORIES.map((c) => {
      const o = overrides.find((x) => x.category === c.id);
      return {
        id: c.id,
        en: c.en,
        ne: c.ne,
        unit: c.unit,
        low: o?.low ?? c.low,
        high: o?.high ?? c.high,
        perDay: o?.perDay ?? c.perDay,
        edited: o?.updatedAt ?? null,
      };
    }),
  };

  return (
    <>
      <PageHead title={t.adminDash.nav.moderation} lead={t.admin.lead} />
      <AdminView key={initial} data={data} initial={initial} />
    </>
  );
}
