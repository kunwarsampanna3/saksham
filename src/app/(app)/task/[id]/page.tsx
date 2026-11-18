import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Globe2, CalendarDays, Package, Clock, Users, Plane, Lock, PackageCheck, Unlock, ShieldCheck, Info } from "lucide-react";
import { Contours } from "@/components/contours";
import { CATEGORY_ICONS } from "@/components/browse/cards";
import { TaskLive, type Live } from "@/components/task/task-live";
import { ExplainRange } from "@/components/task/explain-range";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { ensureExampleTasks, canView, isOwner, rankedOffers, categoryLabel } from "@/lib/tasks";
import { statusFor } from "@/lib/verification";
import { isCountable, type CategoryId } from "@/lib/pricing";
import { rs, rsRange } from "@/lib/format";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = await store.getTask((await params).id);
  return { title: t ? t.title : "Task" };
}

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Params }) {
  const { id } = await params;
  const [user, { t, lang }] = await Promise.all([requireUser(`/task/${id}`), getDict()]);
  await ensureExampleTasks();
  const task = /^[\w-]{3,64}$/.test(id) ? await store.getTask(id) : null;
  // Women-only tasks are indistinguishable from missing ones for anyone who may not see them.
  if (!task || !(await canView(task, user))) notFound();

  const k = t.task;
  const owner = isOwner(task, user);
  const [offers, questions, vstatus] = await Promise.all([rankedOffers(task, user), store.listQuestions(task.id), statusFor(user)]);
  const initial: Live = {
    status: task.status, agreedPrice: task.agreedPrice ?? null, acceptedBidId: task.acceptedBidId ?? null, owner,
    offers: offers as Live["offers"],
    questions: questions.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((q) => ({ id: q.id, askerName: q.askerName, body: q.body, answer: q.answer ?? null, mine: q.askerId === user.id })),
  };
  const Icon = CATEGORY_ICONS[task.category as CategoryId] ?? CATEGORY_ICONS.other;
  const title = lang === "ne" && task.titleNe ? task.titleNe : task.title;
  const locale = lang === "ne" ? "ne-NP" : "en-GB";
  const posted = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kathmandu" }).format(new Date(task.createdAt));
  const due = task.dueDate ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kathmandu" }).format(new Date(`${task.dueDate}T12:00:00Z`)) : null;
  const booking = await store.getBookingByTask(task.id);
  const party = booking && (booking.clientId === user.id || booking.providerId === user.id);
  const states = booking?.installments.map((i) => i.state) ?? [];
  // Escrow bar: 1 = something held, 2 = work delivered/partly released, 3 = everything released
  const escrowStep = !booking ? 0 : states.every((s) => s === "released") ? 3 : states.some((s) => s === "delivered" || s === "released") ? 2 : states.some((s) => s === "held") ? 1 : 0;

  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={task.id.length + 3} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-6 sm:px-6">
          <Link href="/explore" className="btn btn-quiet -ml-2"><ArrowLeft size={16} aria-hidden /> {t.explore.title}</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-accent"><Icon size={17} aria-hidden /> {categoryLabel(task.category, lang)}</span>
            {task.isExample && <span className="demo-tag">{t.browse.example}</span>}
            {task.womenOnly && <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#fbe9e3] px-2 py-0.5 text-xs font-bold text-[#8a3a1d] dark:bg-[#3a1d12] dark:text-[#f0b49c]"><Users size={12} aria-hidden /> {t.post.womenOnly}</span>}
            {task.forFamilyAbroad && <span className="inline-flex items-center gap-1 text-sm text-muted"><Plane size={14} aria-hidden /> {t.home.live.fromAbroad(task.forFamilyAbroad.country)}</span>}
          </div>
          <h1 className="font-display mt-2 max-w-4xl text-3xl font-extrabold sm:text-5xl" lang={lang}>{title}</h1>
          <p className="mt-2 text-muted">{k.posted(posted)} · {k.by(task.isExample ? t.browse.example : task.clientName.split(" ")[0])}</p>
          {task.isExample && <p className="mt-3 inline-flex items-center gap-2 text-sm text-muted"><Info size={15} aria-hidden /> {k.exampleTask}</p>}
        </div>
      </div>

      <div className="mx-auto mt-8 grid max-w-[88rem] gap-10 px-4 pb-10 sm:px-6 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-8">
          <section aria-labelledby="det-h">
            <h2 id="det-h" className="font-display text-2xl font-bold">{k.details}</h2>
            {task.details && task.details !== task.title && <p className="mt-3 max-w-3xl whitespace-pre-line text-lg leading-relaxed">{task.details}</p>}
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.95rem]">
              <li className="inline-flex items-center gap-1.5">{task.online ? <Globe2 size={16} aria-hidden className="text-accent" /> : <MapPin size={16} aria-hidden className="text-accent" />} {task.online ? t.browse.online : `${task.area ? `${task.area}, ` : ""}${task.city}`}</li>
              {isCountable(task.category) && task.quantity > 1 && <li className="inline-flex items-center gap-1.5"><Package size={16} aria-hidden className="text-accent" /> {k.quantity(task.quantity)}</li>}
              <li className="inline-flex items-center gap-1.5"><Clock size={16} aria-hidden className="text-accent" /> {k.days(task.days)}</li>
              <li className="inline-flex items-center gap-1.5"><CalendarDays size={16} aria-hidden className="text-accent" /> {due ? k.due(due) : k.flexible}</li>
            </ul>
            {task.photos.length > 0 && (
              <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={k.photos}>
                {task.photos.map((p, i) => (
                  <li key={p.id} className="aspect-[4/3] overflow-hidden rounded-[4px] bg-surface-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected route, not optimisable */}
                    <img src={`/api/tasks/${task.id}/photo/${p.id}`} alt={`${title} — ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <TaskLive
            taskId={task.id}
            initial={initial}
            isProvider={user.activeRole === "provider" && user.roles.includes("provider")}
            idVerified={vstatus.id.status === "verified"}
            fairLow={task.fairLow}
            fairHigh={task.fairHigh}
            taskDays={task.days}
            scheduleHref={party ? `/payments/${booking!.id}` : null}
          />
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <section aria-labelledby="price-h" className="notch-frame">
            <div className="notch-card terrace-edge p-5">
              <h2 id="price-h" className="text-xs font-semibold uppercase tracking-wider text-muted">{k.fairRange}</h2>
              <p className="font-display text-3xl font-extrabold text-accent">{rsRange(task.fairLow, task.fairHigh, lang)}</p>
              <ExplainRange taskId={task.id} />
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{k.budget}</p>
                <p className="font-display text-xl font-bold">{task.budget !== null ? rs(task.budget, lang) : k.noBudget}</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="escrow-h" className="relative overflow-hidden rounded-[4px] bg-forest p-5 text-[#d9e8dd] [--contour:rgba(108,195,106,.12)]">
            <Contours seed={9} centers={1} rings={5} />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <h2 id="escrow-h" className="font-display text-xl font-bold text-white">{k.escrow}</h2>
                <span className="demo-tag !border-white/40 !bg-white/10 !text-white">{t.common.sandbox}</span>
              </div>
              <p className="mt-1 text-sm">{k.escrowLead}</p>
              <ol className="mt-4 flex items-end gap-1.5">
                {k.escrowSteps.map((s, i) => {
                  const IconS = [Lock, PackageCheck, Unlock][i];
                  const done = escrowStep > i;
                  return (
                    <li key={s} className="flex-1">
                      <div className={done ? "bg-leaf" : "bg-white/15"} style={{ height: `${8 + i * 8}px` }} aria-hidden />
                      <span className="mt-1.5 flex items-center gap-1 text-xs font-semibold"><IconS size={12} aria-hidden /> {s}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-sm font-semibold text-leaf">{task.agreedPrice ? rs(task.agreedPrice, lang) : k.escrowNotYet}</p>
            </div>
          </section>

          <section aria-labelledby="guar-h" className="rounded-[4px] border border-line p-5">
            <h2 id="guar-h" className="font-display flex items-center gap-2 text-lg font-bold"><ShieldCheck size={18} aria-hidden className="text-accent" /> {k.guarantee}</h2>
            <p className="mt-1 text-sm text-muted">{k.guaranteeLead}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
