import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { PrintButton } from "@/components/pay/print-button";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { roleIn } from "@/lib/escrow";
import { rs } from "@/lib/format";

export const metadata: Metadata = { title: "Receipt" };
export const dynamic = "force-dynamic";

/** Printable sandbox receipt. Visible only to the two parties (and admins). */
export default async function ReceiptPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const [user, { t, lang }] = await Promise.all([requireUser(`/payments/${id}`), getDict()]);
  const booking = /^[0-9a-f-]{36}$/.test(id) ? await store.getBooking(id) : null;
  if (!booking || (!roleIn(booking, user) && !user.isAdmin)) notFound();
  const r = (await store.listReceipts(booking.id)).find((x) => x.id === rid);
  if (!r) notFound();
  const task = await store.getTask(booking.taskId);
  const client = await store.getUserById(booking.clientId);
  const inst = booking.installments.find((i) => i.id === r.installmentId);
  const k = t.receipt;
  const when = new Intl.DateTimeFormat(lang === "ne" ? "ne-NP" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(r.createdAt));
  const rows: [string, string][] = [
    [k.no, r.receiptNo],
    [k.date, when],
    [k.type, t.payments.receiptKinds[r.kind]],
    [k.task, `${task?.title ?? ""}${inst ? ` — ${t.booking.labels[inst.label]} (${inst.pct}%)` : ""}`],
    [
      k.from,
      r.kind === "refund" ? "Saksham escrow" : r.kind === "release" ? "Saksham escrow" : (client?.name ?? ""),
    ],
    [
      k.to,
      r.kind === "release"
        ? booking.providerName
        : r.kind === "refund"
          ? (client?.name ?? "")
          : "Saksham escrow",
    ],
    [k.method, t.booking.methods[r.method]],
    [k.ref, r.ref],
    [k.amount, rs(r.amount, lang)],
    ...(r.kind === "release"
      ? ([
          [k.fee, rs(r.fee, lang)],
          [k.net, rs(r.amount - r.fee, lang)],
        ] as [string, string][])
      : []),
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 print:py-0">
      <article className="notch-frame">
        <div className="notch-card terrace-edge p-6 sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <Logo />
            <span className="demo-tag">{t.common.sandbox}</span>
          </div>
          <h1 className="font-display mt-6 text-3xl font-extrabold">{k.title}</h1>
          <dl className="divide-line border-line mt-5 divide-y border-y">
            {rows.map(([dt, dd]) => (
              <div key={dt} className="grid grid-cols-[10rem_1fr] gap-3 py-2.5 text-[0.95rem]">
                <dt className="text-muted">{dt}</dt>
                <dd className={dt === k.amount ? "font-display text-xl font-extrabold" : "font-semibold"}>
                  {dd}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-muted mt-5 text-xs font-semibold">{k.sandbox}</p>
          <div className="mt-6 print:hidden">
            <PrintButton label={k.print} />
          </div>
        </div>
      </article>
    </div>
  );
}
