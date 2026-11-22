"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { postJson, useI18n } from "@/components/providers";
import { useDismiss } from "@/components/use-dismiss";
import { eventText } from "@/lib/events";
import { npDate } from "@/lib/format";

interface NotifItem {
  id: string;
  kind: string;
  code: string;
  params: Record<string, string | number>;
  href: string;
  read: boolean;
  at: string;
}
export interface Badges {
  unread: number;
  messages: number;
  items: NotifItem[];
}

/** Polls notification + unread-message counts (every 20 s, and on navigation). */
export function useBadges(enabled: boolean) {
  const pathname = usePathname();
  const [b, setB] = useState<Badges>({ unread: 0, messages: 0, items: [] });
  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    if (r?.ok) setB({ unread: r.unread, messages: r.messages, items: r.items });
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void load();
    const tm = setInterval(() => document.visibilityState === "visible" && void load(), 20_000);
    return () => clearInterval(tm);
  }, [enabled, load, pathname]);
  return { ...b, reload: load };
}

export function CountBadge({ n, label }: { n: number; label: string }) {
  if (!n) return null;
  return (
    <span className="bg-clay absolute -top-0.5 -right-0.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1 text-[0.65rem] leading-[1.15rem] font-bold text-white">
      {n > 9 ? "9+" : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

export function Notifications({ badges }: { badges: Badges & { reload: () => Promise<void> } }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const refs = useMemo(() => [btn, pop], []);
  useDismiss(open, close, refs, btn);

  const markAll = async () => {
    await postJson("/api/notifications", { action: "read_all" });
    await badges.reload();
  };

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-label={`${t.nav.notifications}${badges.unread ? ` (${t.notif.unread(badges.unread)})` : ""}`}
        onClick={() => {
          setOpen((o) => !o);
          void badges.reload();
        }}
        className="hover:bg-accent-soft relative inline-flex h-10 w-10 items-center justify-center rounded-md"
      >
        <Bell size={20} aria-hidden />
        <CountBadge n={badges.unread} label={t.notif.unread(badges.unread)} />
      </button>
      {open && (
        <div
          ref={pop}
          role="region"
          aria-label={t.nav.notifications}
          className="border-line bg-surface absolute top-12 right-0 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-md border shadow-[0_12px_40px_-12px_rgba(13,26,20,.35)]"
        >
          <div className="border-line flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="font-display text-base font-bold">{t.notif.title}</h2>
            {badges.unread > 0 && (
              <button
                type="button"
                onClick={() => void markAll()}
                className="text-accent text-sm font-semibold hover:underline"
              >
                {t.notif.markAll}
              </button>
            )}
          </div>
          {badges.items.length === 0 ? (
            <p className="text-muted p-4 text-sm">{t.notif.none}</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {badges.items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(n.href);
                    }}
                    className={`border-line hover:bg-accent-soft flex w-full items-start gap-2.5 border-b px-4 py-3 text-left text-sm ${n.read ? "text-muted" : ""}`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.read ? "" : "font-semibold"}`}>
                        {eventText(t, lang, n.code, n.params)}
                      </span>
                      {typeof n.params.task === "string" && n.params.task && (
                        <span className="text-muted block truncate text-xs">{n.params.task}</span>
                      )}
                      <span className="text-muted block text-xs">{npDate(n.at, lang, { time: true })}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
