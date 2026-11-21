"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Zap, ListChecks } from "lucide-react";
import { useI18n } from "@/components/providers";

/** Quick bid by default; the detailed form when asked for, or when a draft from Home / a provider profile is waiting. */
export function PostTabs({
  initial,
  quick,
  full,
}: {
  initial: "quick" | "full";
  quick: ReactNode;
  full: ReactNode;
}) {
  const { t } = useI18n();
  const q = t.post.quick;
  const [tab, setTab] = useState(initial);
  useEffect(() => {
    try {
      if (sessionStorage.getItem("sk_draft")) setTab("full");
    } catch {
      /* ignore */
    }
  }, []);
  const btn = (id: "quick" | "full", label: string, Icon: typeof Zap) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold transition-colors ${tab === id ? "bg-forest text-white" : "text-muted hover:text-text"}`}
    >
      <Icon size={17} aria-hidden /> {label}
    </button>
  );
  return (
    <div>
      <div role="tablist" className="border-line bg-surface mb-6 inline-flex rounded-full border p-1">
        {btn("quick", q.tabQuick, Zap)}
        {btn("full", q.tabFull, ListChecks)}
      </div>
      <div role="tabpanel">{tab === "quick" ? quick : full}</div>
    </div>
  );
}
