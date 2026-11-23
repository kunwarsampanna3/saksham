"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarCheck,
  FileBarChart,
  Gavel,
  Hourglass,
  LayoutDashboard,
  Settings,
  UserRoundCheck,
  Users,
  Wallet,
} from "lucide-react";

const ITEMS = [
  ["overview", "Overview", "/superadmin", LayoutDashboard],
  ["payments", "Payment Management", "/superadmin/payments", Wallet],
  ["releases", "Pending Releases", "/superadmin/releases", Hourglass],
  ["applicants", "Applicant Management", "/superadmin/applicants", UserRoundCheck],
  ["customers", "Customer Management", "/superadmin/customers", Users],
  ["bookings", "Booking Management", "/superadmin/bookings", CalendarCheck],
  ["disputes", "Disputes", "/superadmin/disputes", Gavel],
  ["transactions", "Transactions", "/superadmin/transactions", ArrowLeftRight],
  ["reports", "Financial Reports", "/superadmin/reports", FileBarChart],
  ["settings", "Settings", "/superadmin/settings", Settings],
] as const;

/** The sidebar. */
export function SaNav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Super Admin" className="min-w-0">
      <ul className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-0">
        {ITEMS.map(([key, label, href, Icon]) => {
          const on = href === "/superadmin" ? path === href : path.startsWith(href);
          const n = badges[key] ?? 0;
          return (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  on
                    ? "bg-white/12 text-white"
                    : "text-[var(--sa-navy-text)] hover:bg-white/6 hover:text-white"
                }`}
              >
                <Icon size={17} aria-hidden className={on ? "text-[var(--leaf)]" : ""} />
                <span className="flex-1">{label}</span>
                {n > 0 && (
                  <span
                    className="rounded-full bg-[#f59e0b] px-1.5 text-xs font-bold text-[#0b1f3a]"
                    aria-label={`${n} waiting`}
                  >
                    {n}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
