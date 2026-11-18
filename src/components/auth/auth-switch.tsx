"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/providers";

/** "Sign up | Log in" switch at the top of both screens; keeps any ?next= so people land where they wanted. */
export function AuthSwitch({ active }: { active: "signup" | "login" }) {
  const { t } = useI18n();
  const next = useSearchParams().get("next");
  const q = next && next.startsWith("/") && !next.startsWith("//") ? `?next=${encodeURIComponent(next)}` : "";
  const item = (key: "signup" | "login", href: string, label: string) => (
    <Link href={`${href}${q}`} aria-current={active === key ? "page" : undefined}
      className={`flex-1 rounded-[6px] px-3 py-2 text-center text-[0.95rem] font-bold transition-colors ${active === key ? "bg-accent text-accent-contrast shadow-sm" : "text-muted hover:text-text"}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label={`${t.login.create} / ${t.login.submit}`} className="mb-6 flex gap-1 rounded-[8px] bg-surface-2 p-1">
      {item("signup", "/signup", t.login.create)}
      {item("login", "/login", t.login.submit)}
    </nav>
  );
}
