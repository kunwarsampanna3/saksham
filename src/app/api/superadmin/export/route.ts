import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/auth/http";
import { currentUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/superadmin";
import { logAdmin } from "@/lib/admin";
import {
  DAY_RE,
  financeSnapshot,
  inDateRange,
  METHOD,
  monthly,
  PAY_STATUS,
  PAYOUT_STATUS,
  STAGE,
  TXN_TYPE,
} from "@/lib/finance";
import { nepalDay } from "@/lib/nepal-time";

const KINDS = ["transactions", "payments", "payouts", "monthly"] as const;
type Kind = (typeof KINDS)[number];

/** A cell a spreadsheet won't run as a formula. */
function cell(v: string | number) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const csv = (head: string[], rows: (string | number)[][]) =>
  // A byte-order mark so Excel opens Nepali names correctly.
  "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

const data = (demo: boolean) => (demo ? "Demo (simulated)" : "Live");

/** CSV financial reports. Super Admin only; everyone else gets 404. Each download is logged. */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!isSuperAdmin(me)) return fail(404, "not_found");
  const q = req.nextUrl.searchParams;
  const kind = q.get("kind") as Kind;
  if (!KINDS.includes(kind)) return fail(400, "bad_kind");
  const from = DAY_RE.test(q.get("from") ?? "") ? q.get("from")! : undefined;
  const to = DAY_RE.test(q.get("to") ?? "") ? q.get("to")! : undefined;

  const s = await financeSnapshot();
  let body: string;
  if (kind === "transactions") {
    body = csv(
      [
        "Transaction ID",
        "Date and time (UTC)",
        "Type",
        "Amount (NPR)",
        "Booking ID",
        "Party",
        "Previous status",
        "Current status",
        "Responsible",
        "Reference",
        "Note",
        "Data",
      ],
      s.txns
        .filter((t) => inDateRange(t.at, from, to))
        .map((t) => [
          t.id,
          t.at,
          TXN_TYPE[t.type].label,
          t.amount,
          t.bookingRef ?? "",
          t.party,
          t.from,
          t.to,
          t.admin,
          t.ref,
          t.note,
          data(t.demo),
        ]),
    );
  } else if (kind === "payments") {
    body = csv(
      [
        "Booking ID",
        "Created",
        "Customer",
        "Applicant",
        "Category",
        "Total",
        "Received",
        "Applicant amount",
        "Held",
        "Released",
        "Refunded",
        "Remaining",
        "Payment status",
        "Milestone",
        "On hold",
        "Data",
      ],
      s.rows
        .filter((r) => inDateRange(r.createdAt, from, to))
        .map((r) => [
          r.ref,
          r.createdAt,
          r.customer.name,
          r.applicant.name,
          r.category,
          r.total,
          r.received,
          r.applicantAmount,
          r.held,
          r.released,
          r.refunded,
          r.remaining,
          PAY_STATUS[r.payStatus].label,
          STAGE[r.stage],
          r.hold ? `Yes: ${r.hold.reason}` : "No",
          data(r.demo),
        ]),
    );
  } else if (kind === "payouts") {
    body = csv(
      [
        "Payout ID",
        "Requested (UTC)",
        "Applicant",
        "Amount",
        "7% fee",
        "Applicant receives",
        "Method",
        "Status",
        "Decided by",
        "Reason",
        "Reference",
        "Data",
      ],
      s.payoutRows
        .filter((p) => inDateRange(p.payout.createdAt, from, to))
        .map((p) => [
          p.ref,
          p.payout.createdAt,
          p.applicant.name,
          p.payout.amount,
          p.payout.fee ?? 0,
          p.net,
          METHOD[p.payout.method],
          PAYOUT_STATUS[p.payout.status].label,
          p.payout.review?.byName ?? "",
          p.payout.review?.reason ?? "",
          p.payout.ref,
          data(p.applicant.demo),
        ]),
    );
  } else {
    body = csv(
      [
        "Month",
        "Received from customers",
        "Released to applicants",
        "Refunded",
        "Sent to applicants' accounts",
        "Saksham revenue",
      ],
      monthly(s, 12).map((m) => [m.key, m.received, m.released, m.refunded, m.payouts, m.revenue]),
    );
  }
  await logAdmin(me, "finance_export", kind, [from, to].filter(Boolean).join(" to "));
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="saksham-${kind}-${nepalDay()}.csv"`,
      "cache-control": "no-store",
    },
  });
}
