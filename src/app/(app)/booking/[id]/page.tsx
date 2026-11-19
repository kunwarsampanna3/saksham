import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Contours } from "@/components/contours";
import { BookingForm } from "@/components/pay/booking-form";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { planPreview } from "@/lib/escrow";
import { FEE_RATE } from "@/lib/pricing";

export const metadata: Metadata = { title: "Book and pay" };
export const dynamic = "force-dynamic";

/** /booking/:taskId — choose a payment plan for the accepted offer. */
export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, { t }] = await Promise.all([requireUser(`/booking/${id}`), getDict()]);
  const task = /^[\w-]{3,64}$/.test(id) ? await store.getTask(id) : null;
  if (!task || task.clientId !== user.id) notFound();
  const existing = await store.getBookingByTask(task.id);
  if (existing) redirect(`/payments/${existing.id}`);

  const b = t.booking;
  const bid = task.acceptedBidId ? (await store.listBids(task.id)).find((x) => x.id === task.acceptedBidId) : undefined;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={27} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-6 sm:px-6">
          <Link href={`/task/${task.id}`} className="btn btn-quiet -ml-2"><ArrowLeft size={16} aria-hidden /> {task.title}</Link>
          <h1 className="font-display mt-2 text-4xl font-extrabold sm:text-5xl">{b.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{b.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        {task.status !== "assigned" || !task.agreedPrice || !bid ? (
          <p className="rounded-[4px] border border-dashed border-line-strong p-6">
            {b.notAssigned} <Link href={`/task/${task.id}`} className="font-semibold text-accent hover:underline">{t.payments.open}</Link>
          </p>
        ) : (
          <BookingForm
            taskId={task.id}
            taskTitle={task.title}
            total={task.agreedPrice}
            providerName={bid.providerName}
            feeRate={FEE_RATE}
            abroad={task.forFamilyAbroad?.country ?? null}
            previews={{
              full: planPreview(task.agreedPrice, "full", task),
              two: planPreview(task.agreedPrice, "two", task),
              milestones: planPreview(task.agreedPrice, "milestones", task),
            }}
          />
        )}
      </div>
    </div>
  );
}
