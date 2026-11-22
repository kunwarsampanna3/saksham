import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Contours } from "@/components/contours";
import { PaymentSchedule } from "@/components/pay/schedule";
import { RateBox } from "@/components/pay/rate-box";
import { FamilyPanel } from "@/components/abroad/family-panel";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { providerNet, roleIn } from "@/lib/escrow";
import { config } from "@/lib/config";
import { rs } from "@/lib/format";

export const metadata: Metadata = { title: "Payment schedule" };
export const dynamic = "force-dynamic";

export default async function PaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { t, lang }] = await Promise.all([requireUser(`/payments/${id}`), getDict()]);
  const booking = /^[0-9a-f-]{36}$/.test(id) ? await store.getBooking(id) : null;
  const role = booking ? (roleIn(booking, user) ?? (user.isAdmin ? "admin" : null)) : null;
  if (!booking || !role) notFound();

  const [task, receipts, disputes, rating] = await Promise.all([
    store.getTask(booking.taskId),
    store.listReceipts(booking.id),
    store.listDisputes(booking.id),
    store.getRatingByBooking(booking.id),
  ]);
  const k = t.payments;
  const dispute = disputes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={36} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pt-6 pb-8 sm:px-6">
          <Link href={`/task/${booking.taskId}`} className="btn btn-quiet -ml-2">
            <ArrowLeft size={16} aria-hidden /> {task?.title ?? k.open}
          </Link>
          <h1 className="font-display mt-2 text-4xl font-extrabold sm:text-5xl">{k.title}</h1>
          <p className="text-muted mt-2 max-w-2xl text-lg">
            {role === "provider" ? k.leadProvider : k.leadClient}
          </p>
          <p className="mt-3 text-sm">
            <span className="text-muted">{k.withProvider}:</span> <strong>{booking.providerName}</strong>
            {booking.providerIsExample && <span className="demo-tag ml-2">{t.browse.example}</span>}
            <span className="text-muted mx-2">·</span>
            <span className="text-muted">{k.net}:</span> <strong>{rs(providerNet(booking), lang)}</strong>
            <span className="demo-tag ml-2">{t.common.sandbox}</span>
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <PaymentSchedule
          bookingId={booking.id}
          role={role}
          status={booking.status}
          providerName={booking.providerName}
          taskTitle={task?.title}
          feeRate={booking.feeRate}
          plan={booking.plan}
          halfDoneAt={booking.halfDoneAt}
          providerIsExample={booking.providerIsExample}
          method={booking.method}
          demoMode={config.demoMode}
          canResolveDemo={config.demoMode && user.isDemo}
          installments={booking.installments}
          receipts={receipts
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((r) => ({
              id: r.id,
              kind: r.kind,
              amount: r.amount,
              fee: r.fee,
              receiptNo: r.receiptNo,
              createdAt: r.createdAt,
            }))}
          dispute={
            dispute
              ? {
                  status: dispute.status,
                  reason: dispute.reason,
                  wanted: dispute.wanted,
                  resolution: dispute.resolution,
                }
              : null
          }
        />
        {role === "client" && task?.forFamilyAbroad && (
          <div className="mt-8 max-w-2xl">
            <FamilyPanel
              bookingId={booking.id}
              familyName={booking.family?.name ?? task.forFamilyAbroad.familyName ?? ""}
              confirmations={booking.family?.confirmations ?? []}
              labels={Object.fromEntries(
                booking.installments.map((i) => [
                  i.id,
                  i.label === "kept" ? t.market.money.halfStep : t.booking.labels[i.label],
                ]),
              )}
            />
          </div>
        )}
        {booking.status === "completed" && role === "client" && (
          <div className="mt-8 max-w-xl">
            <RateBox
              bookingId={booking.id}
              providerName={booking.providerName}
              rated={rating ? { stars: rating.stars, text: rating.text } : null}
            />
          </div>
        )}
      </div>
    </div>
  );
}
