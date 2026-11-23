import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { LangSwitch, ThemeToggle } from "@/components/prefs-controls";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/admin";
import { getDict } from "@/lib/i18n/server";
import { config } from "@/lib/config";
import { PublicDemoNote } from "@/components/public-demo-note";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

/** The dashboard has its own frame: no marketplace header, footer or assistant. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [admin, { t }] = await Promise.all([requireAdmin(), getDict()]);
  const d = t.adminDash;
  return (
    <>
      {config.publicDemo && <PublicDemoNote t={t} />}
      <header className="border-line bg-surface border-b">
        <a href="#main" className="skip-link">
          {t.nav.skip}
        </a>
        <div className="mx-auto flex max-w-[96rem] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="bg-marigold rounded-[3px] px-2 py-0.5 text-xs font-bold text-[#0d1a14]">
              {d.brand}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted hidden text-sm md:inline">{admin.name}</span>
            <LangSwitch />
            <ThemeToggle />
            <Link href="/" className="btn btn-ghost !min-h-10 text-sm">
              <ArrowLeft size={16} aria-hidden /> {d.back}
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[96rem] grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <AdminNav />
        <main id="main" tabIndex={-1} className="min-w-0 pb-10 outline-none">
          {admin.isDemo && (
            <p className="bg-surface-2 mb-5 rounded-[6px] p-3 text-sm" data-demo-admin>
              {d.demoAdmin}
            </p>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
