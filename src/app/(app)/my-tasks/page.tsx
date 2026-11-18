import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Compass, ArrowRight, Wallet, MessageSquare, Users, AlertTriangle } from "lucide-react";
import { Contours } from "@/components/contours";
import { CATEGORY_ICONS } from "@/components/browse/cards";
import { StartChat } from "@/components/chat/start-chat";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import type { Bid, Booking, Task } from "@/lib/store/types";
import { categoryLabel } from "@/lib/tasks";
import { rs } from "@/lib/format";
import type { CategoryId } from "@/lib/pricing";

export const metadata: Metadata = { title: "My tasks" };
export const dynamic = "force-dynamic";

type Tab = "posted" | "offers" | "progress" | "done";
interface Row { task: Task; role: "client" | "provider"; bid?: Bid; offers: number; booking: Booking | null; stage: number; counterpartId: string | null }

/** 0 Posted · 1 Offers · 2 Accepted · 3 Paid · 4 Delivered · 5 Released */
function stageOf(task: Task, offers: number, booking: Booking | null): number {
  if (booking) {
    const s = booking.installments.map((i) => i.state);
    if (s.every((x) => x === "released")) return 5;
    if (s.some((x) => x === "delivered" || x === "released")) return 4;
    if (s.some((x) => x === "held")) return 3;
    return 2;
  }
  if (task.status === "assigned") return 2;
  return offers > 0 ? 1 : 0;
}

export default async function MyTasks({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [user, { t, lang }, sp] = await Promise.all([requireUser("/my-tasks"), getDict(), searchParams]);
  const d = t.dash;
  const tab: Tab = (["posted", "offers", "progress", "done"] as const).find((x) => x === sp.tab) ?? "posted";

  const now = Date.now();
  const rows: Row[] = [];
  for (const task of await store.listTasks()) {
    const bids = (await store.listBids(task.id)).filter((b) => b.status !== "withdrawn" && new Date(b.appearAt).getTime() <= now);
    const mine = bids.find((b) => b.providerId === user.id);
    const isClient = task.clientId === user.id;
    if (!isClient && !mine) continue;
    const booking = await store.getBookingByTask(task.id);
    const accepted = bids.find((b) => b.id === task.acceptedBidId);
    rows.push({
      task, role: isClient ? "client" : "provider", bid: mine, offers: bids.length, booking,
      stage: stageOf(task, bids.length, booking),
      counterpartId: isClient ? (accepted && !accepted.isExample ? accepted.providerId : null) : task.clientId,
    });
  }

  const inTab = (r: Row): Tab => {
    const s = r.task.status;
    if (s === "completed" || s === "cancelled" || r.booking?.status === "refunded") return "done";
    if (s === "assigned" || s === "in_progress" || s === "delivered" || s === "disputed") {
      // providers whose offer wasn't chosen see it under "My offers" as closed
      if (r.role === "provider" && r.task.acceptedBidId !== r.bid?.id) return "offers";
      return "progress";
    }
    return r.role === "client" ? "posted" : "offers";
  };
  const groups: Record<Tab, Row[]> = { posted: [], offers: [], progress: [], done: [] };
  for (const r of rows) groups[inTab(r)].push(r);
  for (const k of Object.keys(groups) as Tab[]) groups[k].sort((a, b) => b.task.updatedAt.localeCompare(a.task.updatedAt));
  const list = groups[tab];

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={52} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pb-6 pt-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{d.title}</h1>
              <p className="mt-2 max-w-2xl text-lg text-muted">{d.lead}</p>
            </div>
            <div className="flex gap-2">
              <Link href="/post" className="btn btn-primary"><Plus size={17} aria-hidden /> {d.post}</Link>
              <Link href="/explore" className="btn btn-ghost"><Compass size={17} aria-hidden /> {d.find}</Link>
            </div>
          </div>
          <nav aria-label={d.title} className="mt-6 flex gap-1 overflow-x-auto">
            {(["posted", "offers", "progress", "done"] as const).map((k) => (
              <Link key={k} href={`/my-tasks?tab=${k}`} aria-current={tab === k ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-[4px] border-b-[3px] px-4 font-semibold ${tab === k ? "border-accent text-accent" : "border-transparent text-muted hover:text-text"}`}>
                {d.tabs[k]} <span className={`rounded-[3px] px-1.5 text-xs ${tab === k ? "bg-accent text-accent-contrast" : "bg-surface-2"}`}>{groups[k].length}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6">
        {list.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-line-strong p-10 text-center">
            <p className="font-display text-xl font-bold">{d.empty[tab]}</p>
            <Link href={tab === "offers" ? "/explore" : "/post"} className="btn btn-ghost mt-4">{tab === "offers" ? d.find : d.post} <ArrowRight size={16} aria-hidden /></Link>
          </div>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {list.map((r) => {
              const Icon = CATEGORY_ICONS[r.task.category as CategoryId] ?? CATEGORY_ICONS.other;
              const closedOffer = r.role === "provider" && r.bid?.status === "declined";
              return (
                <li key={r.task.id} className="notch-frame">
                  <article className="notch-card terrace-edge flex h-full flex-col p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent"><Icon size={15} aria-hidden /> {categoryLabel(r.task.category, lang)}</span>
                      <span className="flex items-center gap-1.5">
                        {r.task.isExample && <span className="demo-tag">{t.browse.example}</span>}
                        <span className={`rounded-[3px] px-2 py-0.5 text-xs font-bold ${r.task.status === "disputed" ? "bg-danger-soft text-danger" : r.task.status === "completed" ? "bg-accent text-accent-contrast" : "bg-surface-2 text-muted"}`}>
                          {r.task.status === "disputed" && <AlertTriangle size={11} aria-hidden className="mr-1 inline" />}{d.status[r.task.status]}
                        </span>
                      </span>
                    </div>
                    <h2 className="font-display mt-2 text-lg font-bold leading-snug">
                      <Link href={`/task/${r.task.id}`} className="hover:text-accent">{lang === "ne" && r.task.titleNe ? r.task.titleNe : r.task.title}</Link>
                    </h2>
                    <p className="mt-0.5 text-sm text-muted">
                      {r.role === "client" ? d.asClient : d.asProvider}
                      {r.task.agreedPrice ? ` · ${d.agreed(rs(r.task.agreedPrice, lang))}` : r.role === "client" ? ` · ${d.offersCount(r.offers)}` : r.bid ? ` · ${d.yourOffer(rs(r.bid.amount, lang))}` : ""}
                    </p>
                    {r.role === "provider" && r.bid?.counter?.status === "pending" && (
                      <p className="mt-1 text-sm font-semibold text-[color:var(--warn-text)]">{d.counterWaiting}</p>
                    )}

                    {/* terrace progress */}
                    {!closedOffer && (
                      <ol className="mt-4 flex items-end gap-1" aria-label={`${d.stages[r.stage]} (${r.stage + 1}/6)`}>
                        {d.stages.map((s, i) => (
                          <li key={s} className="min-w-0 flex-1" aria-current={i === r.stage ? "step" : undefined}>
                            <div className={i < r.stage ? "bg-leaf" : i === r.stage ? "bg-accent" : "bg-line"} style={{ height: `${5 + i * 4}px` }} aria-hidden />
                            <span className={`mt-1 block truncate text-[0.68rem] font-semibold ${i === r.stage ? "text-accent" : "text-muted"}`}>{s}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    <div className="mt-auto flex flex-wrap gap-2 pt-4">
                      <Link href={`/task/${r.task.id}`} className="btn btn-ghost !min-h-10">{d.open}</Link>
                      {r.booking && <Link href={`/payments/${r.booking.id}`} className="btn btn-ghost !min-h-10"><Wallet size={16} aria-hidden /> {d.schedule}</Link>}
                      {r.counterpartId && !r.task.isExample && (
                        <StartChat taskId={r.task.id} withUserId={r.role === "client" ? r.counterpartId : undefined} label={d.chat} />
                      )}
                      {r.role === "client" && r.task.status === "open" && r.offers > 0 && (
                        <span className="ml-auto inline-flex items-center gap-1 self-center text-sm font-semibold text-accent"><Users size={15} aria-hidden /> {d.offersCount(r.offers)}</span>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
