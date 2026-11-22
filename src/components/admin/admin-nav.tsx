"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useI18n } from "@/components/providers";

const ITEMS = [
  ["overview", "/admin", LayoutDashboard],
  ["users", "/admin/users", Users],
  ["traffic", "/admin/traffic", BarChart3],
  ["posts", "/admin/posts", ClipboardList],
  ["money", "/admin/money", Wallet],
  ["credit", "/admin/credit", HandCoins],
  ["moderation", "/admin/moderation", ShieldCheck],
  ["activity", "/admin/activity", Activity],
] as const;

export function AdminNav() {
  const { t } = useI18n();
  const path = usePathname();
  return (
    <nav aria-label={t.adminDash.brand} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {ITEMS.map(([key, href, Icon]) => {
          const on = href === "/admin" ? path === href : path.startsWith(href);
          return (
            <li key={key} className="shrink-0">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-[6px] px-3 text-sm font-semibold whitespace-nowrap ${on ? "bg-accent text-accent-contrast" : "hover:bg-accent-soft"}`}
              >
                <Icon size={17} aria-hidden /> {t.adminDash.nav[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
