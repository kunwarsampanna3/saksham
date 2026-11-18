"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { postJson, useUser } from "@/components/providers";
import type { PublicUser } from "@/lib/store/types";

/** Adds the provider role to a client account, switches to it, then opens verification. */
export function ProviderButton({ label, className = "btn btn-primary" }: { label: string; className?: string }) {
  const { setUser } = useUser();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await postJson<{ user: PublicUser }>("/api/auth/role", { role: "provider", enable: true });
        setBusy(false);
        if (r.ok) { setUser(r.user); router.push("/verification"); router.refresh(); }
      }}
    >
      {label} <ArrowRight size={18} aria-hidden />
    </button>
  );
}
