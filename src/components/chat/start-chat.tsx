"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { postJson } from "@/components/providers";

/** Opens (or creates) the conversation for a task and jumps to it. */
export function StartChat({
  taskId,
  withUserId,
  label,
  className = "btn btn-ghost !min-h-10",
}: {
  taskId: string;
  withUserId?: string;
  label: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await postJson<{ id: string }>("/api/messages", { taskId, withUserId });
        setBusy(false);
        if (r.ok && r.id) router.push(`/messages?c=${r.id}`);
      }}
    >
      <MessageSquare size={16} aria-hidden /> {label}
    </button>
  );
}
