import "server-only";
import { store } from "@/lib/store";
import type { Booking, PostPayment, User } from "@/lib/store/types";
import { jobProgress } from "@/lib/abroad-state";
import { asOfNow } from "@/lib/post-state";
import { canManage, canSeePrivate } from "@/lib/admin";

/** Read-only numbers and lists for the dashboard. */

export const sumPieces = (bookings: Booking[], ...states: Booking["installments"][number]["state"][]) =>
  bookings
    .flatMap((b) => b.installments)
    .filter((i) => states.includes(i.state))
    .reduce((n, i) => n + i.amount, 0);

export const paidIn = (b: Booking) => sumPieces([b], "held", "delivered", "released", "refunded");

export interface PostRow {
  id: string;
  kind: "task" | "abroad";
  href: string;
  title: string;
  clientId: string | null;
  clientName: string;
  example: boolean;
  post?: PostPayment;
  status: string;
  group: "live" | "hired" | "ended";
  applicants: number;
  removable: boolean;
  createdAt: string;
}

export async function allPosts(): Promise<PostRow[]> {
  const [tasks, jobs, bookings] = await Promise.all([
    store.listTasks(),
    store.listAbroadJobs(),
    store.listBookings(),
  ]);
  const booked = new Map(bookings.map((b) => [b.taskId, b]));
  const now = Date.now();
  const rows: PostRow[] = await Promise.all(
    tasks
      .filter((t) => !t.abroad) // a hire abroad is listed as its job
      .map(async (saved) => {
        const t = asOfNow(saved, now);
        const bids = await store.listBids(t.id);
        return {
          id: t.id,
          kind: "task" as const,
          href: `/task/${t.id}`,
          title: t.title,
          clientId: t.clientId,
          clientName: t.clientName,
          example: t.isExample,
          post: t.post,
          status: t.removed ? "removed" : t.status,
          group:
            t.status === "open"
              ? ("live" as const)
              : ["completed", "cancelled", "expired"].includes(t.status)
                ? ("ended" as const)
                : ("hired" as const),
          applicants: bids.filter((b) => b.status !== "withdrawn" && Date.parse(b.appearAt) <= now).length,
          removable: !t.removed && !booked.has(t.id) && ["open", "expired", "assigned"].includes(t.status),
          createdAt: t.createdAt,
        };
      }),
  );
  for (const j of jobs) {
    const { state } = jobProgress(j, booked);
    rows.push({
      id: j.id,
      kind: "abroad",
      href: `/abroad/jobs/${j.id}`,
      title: j.title,
      clientId: j.clientId,
      clientName: j.clientName,
      example: false,
      post: j.post,
      status: j.removed ? "removed" : state,
      group: j.removed ? "ended" : state === "open" ? "live" : state === "filled" ? "hired" : "ended",
      applicants: j.applications.filter((a) => a.status !== "withdrawn").length,
      removable: !j.removed && state !== "completed",
      createdAt: j.createdAt,
    });
  }
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function moneyOverview() {
  const [users, bookings, tasks, jobs] = await Promise.all([
    store.listUsers(),
    store.listBookings(),
    store.listTasks(),
    store.listAbroadJobs(),
  ]);
  const payouts = (await Promise.all(users.map((u) => store.listPayouts(u.id))))
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const receipts = (await Promise.all(bookings.map((b) => store.listReceipts(b.id)))).flat();
  const posting = [...tasks, ...jobs]
    .flatMap((p) =>
      p.post
        ? [{ id: p.id, title: p.title, clientId: p.clientId, clientName: p.clientName, post: p.post }]
        : [],
    )
    .sort((a, b) => b.post.paidAt.localeCompare(a.post.paidAt));

  const postFees = posting.reduce((n, p) => n + p.post.fee, 0);
  // Only withdrawals that were sent earned their 7%; waiting or rejected ones haven't.
  const withdrawFees = payouts
    .filter((p) => p.status === "sent_sandbox")
    .reduce((n, p) => n + (p.fee ?? 0), 0);
  const releaseFees = receipts.filter((r) => r.kind === "release").reduce((n, r) => n + r.fee, 0);
  const toAccounts = sumPieces(
    bookings.filter((b) => !b.providerIsExample),
    "released",
  );
  return {
    users,
    bookings: [...bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    payouts,
    posting,
    postFees,
    withdrawFees,
    releaseFees,
    earned: postFees + withdrawFees + releaseFees,
    held: sumPieces(bookings, "held", "delivered"),
    refunded: sumPieces(bookings, "refunded"),
    toCome: sumPieces(
      bookings.filter((b) => b.status === "active"),
      "scheduled",
    ),
    inWallets: Math.max(
      0,
      toAccounts -
        releaseFees -
        payouts.filter((p) => p.status !== "rejected").reduce((n, p) => n + p.amount, 0),
    ),
  };
}

export async function creditQueue(admin: User) {
  const users = await store.listUsers();
  const rows = await Promise.all(
    users.map(async (u) =>
      (await store.listCreditApplications(u.id)).map((a) => ({
        ...a,
        user: u,
        visible: canSeePrivate(admin, u),
        decidable:
          a.status === "submitted_demo" && canSeePrivate(admin, u) && (u.id !== admin.id || admin.isDemo),
      })),
    ),
  );
  return rows.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const USER_FILTERS = [
  "all",
  "provider",
  "client",
  "verified",
  "unverified",
  "suspended",
  "admin",
  "real",
  "demo",
] as const;
export type UserFilter = (typeof USER_FILTERS)[number];

export function filterUsers(admin: User, users: User[], q: string, show: UserFilter) {
  const want = q.trim().toLowerCase();
  const digits = want.replace(/\D/g, "");
  return users
    .filter((u) => {
      if (show === "provider" || show === "client") return u.roles.includes(show);
      if (show === "verified") return !!u.verified;
      if (show === "unverified") return !u.verified;
      if (show === "suspended") return !!u.suspended;
      if (show === "admin") return u.isAdmin;
      if (show === "real") return !u.isDemo;
      if (show === "demo") return u.isDemo;
      return true;
    })
    .filter((u) => {
      if (!want) return true;
      if (`${u.name} ${u.city}`.toLowerCase().includes(want)) return true;
      // Searching hidden contacts would give them away one digit at a time.
      if (!canSeePrivate(admin, u)) return false;
      return (digits.length > 0 && u.phone.includes(digits)) || !!u.email?.includes(want);
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((u) => ({ user: u, manageable: canManage(admin, u) }));
}
