import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Contours } from "@/components/contours";
import { AdminView, type AdminData } from "@/components/admin/admin-view";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { config } from "@/lib/config";
import { CATEGORIES } from "@/lib/pricing";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [user, { t }] = await Promise.all([requireUser("/admin"), getDict()]);
  if (!user.isAdmin) notFound();

  const name = async (id?: string | null) => (id ? (await store.getUserById(id))?.name ?? "—" : "—");
  const [pending, reports, bookings, overrides] = await Promise.all([
    store.listPendingVerifications(), store.listReports(), store.listBookings(), store.listPriceOverrides(),
  ]);

  const disputes = (await Promise.all(bookings.map(async (b) => {
    const d = (await store.listDisputes(b.id)).find((x) => x.status === "open");
    if (!d) return null;
    const task = await store.getTask(b.taskId);
    return {
      id: d.id, bookingId: b.id, taskTitle: task?.title ?? "—", openedBy: await name(d.openedBy), role: d.role,
      reason: d.reason, wanted: d.wanted, createdAt: d.createdAt, clientName: await name(b.clientId), providerName: b.providerName,
    };
  }))).filter((x) => x !== null);

  const data: AdminData = {
    demoMode: config.demoMode,
    verifications: await Promise.all(pending.flatMap((v) => (v.kind === "phone" ? [] : [{ ...v, kind: v.kind }])).map(async (v) => ({
      id: v.id, userId: v.userId, userName: await name(v.userId), kind: v.kind, submittedAt: v.submittedAt ?? "",
      fields: v.fields, files: v.files.map((f) => ({ id: f.id, label: f.label, mime: f.mime })),
    }))),
    reports: await Promise.all(reports.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(async (r) => ({
      id: r.id, reason: r.reason, details: r.details, status: r.status, createdAt: r.createdAt,
      reporter: await name(r.reporterId), target: r.targetUserId ? await name(r.targetUserId) : null,
      taskTitle: r.targetTaskId ? (await store.getTask(r.targetTaskId))?.title ?? null : null,
    }))),
    disputes,
    prices: CATEGORIES.map((c) => {
      const o = overrides.find((x) => x.category === c.id);
      return { id: c.id, en: c.en, ne: c.ne, unit: c.unit, low: o?.low ?? c.low, high: o?.high ?? c.high, perDay: o?.perDay ?? c.perDay, edited: o?.updatedAt ?? null };
    }),
  };

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={44} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t.admin.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{t.admin.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <AdminView data={data} />
      </div>
    </div>
  );
}
