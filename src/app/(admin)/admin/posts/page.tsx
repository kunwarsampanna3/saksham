import Link from "next/link";
import { DataTable, PageHead, Panel, Tag } from "@/components/admin/ui";
import { ManageButton } from "@/components/admin/manage";
import { canManagePost, requireAdmin } from "@/lib/admin";
import { allPosts } from "@/lib/admin-data";
import { postPhase } from "@/lib/business";
import { getDict } from "@/lib/i18n/server";
import { npDate, num, rs } from "@/lib/format";

export const dynamic = "force-dynamic";
const FILTERS = ["all", "live", "hired", "ended", "examples"] as const;

export default async function AdminPosts({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const [admin, { t, lang }, sp] = await Promise.all([requireAdmin("/admin/posts"), getDict(), searchParams]);
  const d = t.adminDash;
  const p = d.posts;
  const show = FILTERS.find((f) => f === sp.show) ?? "all";
  const rows = (await allPosts()).filter((r) =>
    show === "all" ? !r.example : show === "examples" ? r.example : !r.example && r.group === show,
  );
  const allowed = await Promise.all(rows.map((r) => r.removable && canManagePost(admin, r)));
  const states: Record<string, string> = {
    ...t.dash.status,
    ...t.abroadJobs.states,
    expired: t.market.post.expiredStatus,
    removed: t.market.post.removedStatus,
  };

  return (
    <>
      <PageHead title={p.title} lead={p.lead} />
      <nav aria-label={p.title} className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin/posts?show=${f}`}
            aria-current={f === show ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${f === show ? "border-accent bg-accent-soft text-accent" : "border-line-strong"}`}
          >
            {p.filters[f]}
          </Link>
        ))}
      </nav>
      <Panel title={`${p.filters[show]} (${num(rows.length, lang)})`}>
        <DataTable
          empty={d.none}
          head={[p.job, p.owner, p.fee, p.clock, p.offers, p.status, ""]}
          rows={rows.map((r, i) => {
            const phase = postPhase(r.post);
            const clock =
              r.group !== "live"
                ? "—"
                : !r.post
                  ? p.noLimit
                  : phase === "paid"
                    ? p.paidUntil(npDate(r.post.endsAt, lang, { time: true }))
                    : p.freeUntil(npDate(r.post.removeAt, lang, { time: true }));
            return {
              key: r.id,
              cells: [
                <span key="job">
                  <Link href={r.href} className="text-accent font-semibold hover:underline">
                    {r.title}
                  </Link>{" "}
                  {r.kind === "abroad" && <Tag>{p.abroad}</Tag>}
                  {r.example && <Tag>{p.example}</Tag>}
                </span>,
                r.clientId ? (
                  <Link key="owner" href={`/admin/users/${r.clientId}`} className="hover:underline">
                    {r.clientName}
                  </Link>
                ) : (
                  r.clientName
                ),
                r.post ? rs(r.post.fee, lang) : p.noFee,
                clock,
                num(r.applicants, lang),
                states[r.status] ?? r.status,
                allowed[i] ? (
                  <ManageButton
                    key="down"
                    body={{ action: "take-down", kind: r.kind, id: r.id }}
                    label={d.actions.takeDown}
                    needsReason
                    danger
                  />
                ) : (
                  ""
                ),
              ],
            };
          })}
        />
      </Panel>
    </>
  );
}
