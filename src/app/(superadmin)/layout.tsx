import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/prefs-controls";
import { SaNav } from "@/components/superadmin/sa-nav";
import { requireSuperAdmin } from "@/lib/superadmin";
import { config } from "@/lib/config";
import { store, storeKind } from "@/lib/store";

export const metadata: Metadata = {
  title: { default: "Super Admin", template: "%s · Saksham Super Admin" },
  robots: { index: false, follow: false },
};

/** Its own frame: navy sidebar, no marketplace header or footer. Each page checks the admin account too. */
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  const waiting = (await store.listAllPayouts()).filter(
    (p) => p.status === "requested" || p.status === "on_hold",
  ).length;

  return (
    <div className="min-h-dvh bg-[var(--sa-bg)] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="bg-[var(--sa-navy)] text-[var(--sa-navy-text)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto">
        <div className="flex items-center gap-2.5 px-4 py-4 lg:px-5 lg:py-5">
          <LogoMark className="h-9 w-9" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-extrabold tracking-wide text-white">SAKSHAM</span>
            <span className="mt-1 text-[0.68rem] font-bold tracking-[0.18em] text-[var(--leaf)]">
              SUPER ADMIN
            </span>
          </span>
        </div>
        <SaNav badges={{ releases: waiting }} />
        <div className="mt-auto hidden border-t border-[var(--sa-navy-line)] px-5 py-4 text-sm lg:block">
          <p className="font-semibold text-white">{user.name}</p>
          <p className="text-xs">Super Admin</p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--leaf)] hover:underline"
          >
            <ArrowLeft size={14} aria-hidden /> Back to Saksham
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="border-line bg-surface flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-[var(--sa-navy)] px-2.5 py-0.5 text-xs font-bold text-white">
              Super Admin
            </span>
            {config.demoMode ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pend-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--pend-text)]">
                <FlaskConical size={13} aria-hidden /> Demo mode · simulated sandbox money, no real transfers
              </span>
            ) : (
              <span className="text-muted text-xs">
                Sandbox payments · data from {storeKind === "supabase" ? "Supabase" : "the local store"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted hidden text-sm sm:inline lg:hidden">{user.name}</span>
            <ThemeToggle />
            <Link href="/" className="btn btn-ghost !min-h-9 text-xs lg:hidden">
              <ArrowLeft size={14} aria-hidden /> Saksham
            </Link>
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          data-sa="super"
          className="mx-auto max-w-[90rem] px-4 py-6 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
