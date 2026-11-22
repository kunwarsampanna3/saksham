import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DataTable, PageHead, Panel, Stats, Tag } from "@/components/admin/ui";
import { ManageButton } from "@/components/admin/manage";
import { canManage, canSeePrivate, contactOf, requireAdmin } from "@/lib/admin";
import { allPosts, paidIn, sumPieces } from "@/lib/admin-data";
import { getDict } from "@/lib/i18n/server";
import { categoryLabel } from "@/lib/tasks";
import { store } from "@/lib/store";
import { walletFor } from "@/lib/wallet";
import { npDate, num, rs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [admin, { t, lang }] = await Promise.all([requireAdmin(`/admin/users/${id}`), getDict()]);
  const u = /^[0-9a-f-]{36}$/.test(id) ? await store.getUserById(id) : null;
  if (!u) notFound();

  const d = t.adminDash;
  const f = d.user;
  const visible = canSeePrivate(admin, u);
  const contact = contactOf(admin, u);
  const [tasks, jobs, bookings, posts, wallet, checks, reports] = await Promise.all([
    store.listTasks(),
    store.listAbroadJobs(),
    store.listBookings(),
    allPosts(),
    walletFor(u),
    store.listVerifications(u.id),
    store.listReports(),
  ]);
  const title = new Map(tasks.map((x) => [x.id, x.title]));
  const mineToPay = bookings.filter((b) => b.clientId === u.id);
  const mine = bookings.filter((b) => b.clientId === u.id || b.providerId === u.id);
  const myPosts = posts.filter((p) => p.clientId === u.id);

  const offers: { key: string; href: string; title: string; amount: number; status: string; at: string }[] =
    [];
  for (const task of tasks) {
    if (task.abroad) continue;
    for (const b of await store.listBids(task.id))
      if (b.providerId === u.id)
        offers.push({
          key: b.id,
          href: `/task/${task.id}`,
          title: task.title,
          amount: b.amount,
          status: b.status,
          at: b.createdAt,
        });
  }
  for (const j of jobs)
    for (const a of j.applications)
      if (a.userId === u.id)
        offers.push({
          key: a.id,
          href: `/abroad/jobs/${j.id}`,
          title: j.title,
          amount: j.payPerWorker,
          status: a.status,
          at: a.createdAt,
        });
  offers.sort((a, b) => b.at.localeCompare(a.at));

  const when = (v?: string | null) => (v ? npDate(v, lang, { time: true }) : "—");
  const states: Record<string, string> = {
    ...t.dash.status,
    ...t.abroadJobs.states,
    ...t.abroadJobs.app,
    expired: t.market.post.expiredStatus,
    removed: t.market.post.removedStatus,
  };
  const account: [string, string][] = [
    [f.phone, contact.phone || "—"],
    [f.email, contact.email || "—"],
    [d.users.roles, u.roles.map((r) => d.users.roleNames[r]).join(", ")],
    [d.users.city, u.city],
    ...(visible
      ? ([
          [f.area, u.area ?? "—"],
          [f.gender, u.gender ? f.genders[u.gender] : "—"],
          [f.contacts, num(u.trustedContacts?.length ?? 0, lang)],
        ] as [string, string][])
      : []),
    [f.language, u.lang === "ne" ? t.lang.ne : t.lang.en],
    [f.skills, u.categories?.map((c) => categoryLabel(c, lang)).join(", ") || "—"],
    [f.joined, when(u.createdAt)],
    [f.updated, when(u.updatedAt)],
    [f.terms, when(u.termsAcceptedAt)],
    [f.marketing, u.marketingOptIn ? d.yes : d.no],
    [f.passkeys, num(u.passkeys.length, lang)],
    [f.failed, num(u.failedAttempts, lang)],
  ];
  if (u.lockedUntil && Date.parse(u.lockedUntil) > Date.now()) account.push([f.locked, when(u.lockedUntil)]);
  if (u.suspended) account.push([f.suspendedWhy, `${u.suspended.reason} (${when(u.suspended.at)})`]);

  return (
    <>
      <Link href="/admin/users" className="btn btn-quiet -ml-2">
        <ArrowLeft size={16} aria-hidden /> {d.users.title}
      </Link>
      <PageHead title={u.name}>
        {canManage(admin, u) ? (
          <div className="flex flex-wrap gap-2">
            {u.suspended ? (
              <ManageButton body={{ action: "unsuspend", userId: u.id }} label={d.actions.unsuspend} />
            ) : (
              <ManageButton
                body={{ action: "suspend", userId: u.id }}
                label={d.actions.suspend}
                needsReason
                danger
              />
            )}
            <ManageButton body={{ action: "sign-out", userId: u.id }} label={d.actions.signOut} />
          </div>
        ) : (
          <p className="text-muted text-sm">{d.actions.protectedNote}</p>
        )}
      </PageHead>
      <p className="mb-4">
        {u.suspended ? <Tag tone="bad">{d.users.suspended}</Tag> : null}
        {u.verified ? <Tag tone="good">{d.users.verified}</Tag> : <Tag>{d.users.unverified}</Tag>}
        {u.isAdmin && <Tag>{d.users.admin}</Tag>}
        {u.isDemo && <Tag>{d.users.demo}</Tag>}
      </p>

      <Stats
        items={[
          { label: f.paidIn, value: rs(wallet.client.paidIn, lang) },
          {
            label: f.postFees,
            value: rs(
              myPosts.reduce((n, p) => n + (p.post?.fee ?? 0), 0),
              lang,
            ),
          },
          { label: f.released, value: rs(wallet.provider.releasedGross, lang) },
          { label: f.balance, value: rs(wallet.provider.available, lang) },
          { label: f.withdrawn, value: rs(wallet.provider.received, lang) },
          { label: f.feePaid, value: rs(wallet.provider.fees, lang) },
          { label: d.money.held, value: rs(sumPieces(mineToPay, "held", "delivered"), lang) },
          { label: d.money.refunded, value: rs(wallet.client.refunded, lang) },
        ]}
      />

      <Panel title={f.account} lead={f.private}>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          {account.map(([label, value]) => (
            <div key={label} className="border-line flex justify-between gap-3 border-b py-2 text-sm">
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0 text-right font-semibold break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title={f.verification}>
        <ul className="flex flex-wrap gap-2 text-sm">
          {(["phone", "id", "selfie", "address", "womenGroup"] as const).map((kind) => {
            const saved = checks.find((c) => c.kind === kind)?.status;
            const state = saved ?? (kind === "phone" && u.phone ? "verified" : "not_started");
            return (
              <li key={kind} className="border-line rounded-[4px] border px-3 py-2">
                <span className="block font-semibold">{t.profile.checks[kind]}</span>
                <Tag tone={state === "verified" ? "good" : state === "rejected" ? "bad" : "plain"}>
                  {f.checkStates[state]}
                </Tag>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title={f.posts}>
        <DataTable
          empty={d.none}
          head={[d.posts.job, d.posts.fee, d.posts.status, d.money.date]}
          rows={myPosts.map((p) => ({
            key: p.id,
            cells: [
              <Link key="job" href={p.href} className="hover:underline">
                {p.title}
              </Link>,
              p.post ? rs(p.post.fee, lang) : d.posts.noFee,
              states[p.status] ?? p.status,
              npDate(p.createdAt, lang),
            ],
          }))}
        />
      </Panel>

      <Panel title={f.offers}>
        <DataTable
          empty={d.none}
          head={[d.money.job, d.money.amount, d.money.status, d.money.date]}
          rows={offers.map((o) => ({
            key: o.key,
            cells: [
              <Link key="job" href={o.href} className="hover:underline">
                {o.title}
              </Link>,
              rs(o.amount, lang),
              states[o.status] ?? o.status,
              npDate(o.at, lang),
            ],
          }))}
        />
      </Panel>

      <Panel title={f.bookings}>
        <DataTable
          empty={d.none}
          head={[d.money.job, d.users.roles, d.money.total, d.money.paidIn, d.money.paidOut, d.money.status]}
          rows={mine.map((b) => ({
            key: b.id,
            cells: [
              <Link key="job" href={`/payments/${b.id}`} className="hover:underline">
                {title.get(b.taskId) ?? "—"}
              </Link>,
              d.users.roleNames[b.clientId === u.id ? "client" : "provider"],
              rs(b.total, lang),
              rs(paidIn(b), lang),
              rs(sumPieces([b], "released"), lang),
              d.money.bookingStates[b.status],
            ],
          }))}
        />
      </Panel>

      <Panel title={f.withdrawals}>
        <DataTable
          empty={d.none}
          head={[d.money.amount, d.money.fee, d.money.received, d.money.date]}
          rows={wallet.payouts.map((p) => ({
            key: p.id,
            cells: [rs(p.amount, lang), rs(p.fee, lang), rs(p.amount - p.fee, lang), when(p.createdAt)],
          }))}
        />
      </Panel>

      <Panel title={f.credit}>
        <DataTable
          empty={d.none}
          head={[d.credit.as, d.credit.amount, d.credit.months, d.money.status, d.money.date]}
          rows={wallet.applications.map((a) => ({
            key: a.id,
            cells: [
              t.market.credit.tabs[a.kind],
              rs(a.amount, lang),
              num(a.months, lang),
              t.market.credit.status[a.status],
              npDate(a.createdAt, lang),
            ],
          }))}
        />
      </Panel>

      {visible && (
        <Panel title={f.reports}>
          <DataTable
            empty={d.none}
            head={["", t.admin.target, t.admin.fields, d.money.status, d.money.date]}
            rows={reports
              .filter((r) => r.reporterId === u.id || r.targetUserId === u.id)
              .map((r) => ({
                key: r.id,
                cells: [
                  r.reporterId === u.id ? f.reportBy : f.reportAbout,
                  r.reason,
                  r.details,
                  t.admin.status[r.status],
                  npDate(r.createdAt, lang),
                ],
              }))}
          />
        </Panel>
      )}
    </>
  );
}
