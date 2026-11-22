"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Coins } from "lucide-react";
import { postJson, useI18n, useUser } from "@/components/providers";
import type { PublicUser } from "@/lib/store/types";

/** Hiring | Working switch on the home page for people who both hire and work. */
export function ModeSwitch({ active }: { active: "client" | "provider" }) {
  const { t } = useI18n();
  const q = t.home.quick;
  const { setUser } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (role: "client" | "provider") => {
    if (role === active || busy) return;
    setBusy(true);
    const r = await postJson<{ user: PublicUser }>("/api/auth/role", { role });
    setBusy(false);
    if (r.ok) {
      setUser(r.user);
      router.refresh();
    }
  };
  const btn = (role: "client" | "provider", label: string, Icon: typeof Coins) => (
    <button
      type="button"
      role="radio"
      aria-checked={active === role}
      disabled={busy}
      onClick={() => void go(role)}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-[0.95rem] font-bold transition-colors ${active === role ? "bg-leaf text-forest" : "text-white/85 hover:text-white"}`}
    >
      <Icon size={17} aria-hidden /> {label}
    </button>
  );
  return (
    <div
      role="radiogroup"
      aria-label={t.nav.modeLabel}
      className="flex w-full gap-1 rounded-full bg-white/10 p-1 sm:w-auto"
    >
      {btn("client", q.modeHiring, Briefcase)}
      {btn("provider", q.modeWorking, Coins)}
    </div>
  );
}
