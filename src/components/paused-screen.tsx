"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle } from "lucide-react";
import { Logo } from "@/components/logo";
import { LangSwitch } from "@/components/prefs-controls";
import { postJson, useI18n } from "@/components/providers";

/** What people see while an admin has paused the site, or while it's full. */
export function PausedScreen({ reason, signedIn }: { reason: "maintenance" | "busy"; signedIn: boolean }) {
  const { t } = useI18n();
  const b = t.market.blocked;
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <main id="main" data-paused={reason} className="mx-auto max-w-lg px-4 py-10">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <LangSwitch />
      </div>
      <div className="mt-16 text-center">
        <PauseCircle size={56} aria-hidden className="text-accent mx-auto" />
        <h1 className="font-display mt-4 text-3xl font-extrabold">{b[reason].title}</h1>
        <p className="text-muted mt-2 text-lg">{b[reason].body}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => router.refresh()}>
            {b.retry}
          </button>
          {signedIn ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={async () => {
                await postJson("/api/auth/logout", {});
                window.location.assign("/login");
              }}
            >
              {b.signOut}
            </button>
          ) : (
            <Link href="/login?next=/admin" className="btn btn-ghost">
              {b.signIn}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
