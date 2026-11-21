"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BadgeCheck,
  ChevronRight,
  Globe2,
  MapPin,
  MessageCircleQuestion,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { LangSwitch, ThemeToggle } from "@/components/prefs-controls";
import { useI18n } from "@/components/providers";
import { initials } from "@/lib/format";
import type { PublicUser } from "@/lib/store/types";
import type { NavLink } from "./nav-links";

/**
 * Slide-in menu for phones and tablets.
 * Rendered into <body> through a portal: the header's backdrop-blur would otherwise
 * trap a position:fixed child inside the 68px header strip.
 */
export function MobileDrawer({
  nav,
  onClose,
  isActive,
  user,
  messages,
}: {
  nav: NavLink[];
  onClose: () => void;
  isActive: (h: string) => boolean;
  user: PublicUser | null;
  messages: number;
}) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus(); // the close button
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      // keep keyboard focus inside the open menu
      const f = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = f[0],
        last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, mounted]);
  if (!mounted) return null;

  const more = user
    ? [
        { href: "/wallet", label: t.nav.wallet, Icon: Wallet },
        { href: "/verification", label: t.nav.verification, Icon: ShieldCheck },
        { href: "/abroad", label: t.nav.abroad, Icon: Globe2 },
        { href: "/safety", label: t.nav.safety, Icon: ShieldAlert },
        { href: "/contact", label: t.footer.contact, Icon: MessageCircleQuestion },
        ...(user.isAdmin ? [{ href: "/admin", label: t.nav.admin, Icon: UserRound }] : []),
      ]
    : [];
  const item = ({ href, label, Icon }: NavLink, badge = 0) => {
    const active = isActive(href);
    return (
      <li key={href}>
        <Link
          href={href}
          onClick={onClose}
          aria-current={active ? "page" : undefined}
          className={`relative flex min-h-12 items-center gap-3 rounded-md px-3 font-semibold transition-colors ${active ? "bg-accent-soft text-accent" : "text-text hover:bg-accent-soft"}`}
        >
          {active && (
            <span aria-hidden className="bg-accent absolute inset-y-2 left-0 w-[3px] rounded-full" />
          )}
          <Icon size={20} aria-hidden className={active ? "text-accent" : "text-muted"} />
          <span className="flex-1">{label}</span>
          {badge > 0 && (
            <span className="bg-clay rounded-full px-2 py-0.5 text-xs font-bold text-white">
              {badge > 9 ? "9+" : badge}
              <span className="sr-only"> {t.msg.title}</span>
            </span>
          )}
          <ChevronRight size={16} aria-hidden className="text-muted" />
        </Link>
      </li>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] xl:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t.nav.menu}
      id="mobile-drawer"
    >
      <button
        type="button"
        className="drawer-fade bg-ink/55 absolute inset-0 backdrop-blur-[2px]"
        aria-label={t.common.close}
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panel}
        className="drawer-slide border-line bg-bg absolute inset-y-0 left-0 flex w-[min(21rem,88vw)] flex-col border-r shadow-2xl"
      >
        <div className="border-line flex h-[var(--header-h)] shrink-0 items-center justify-between border-b px-4">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="border-line hover:bg-accent-soft inline-flex h-10 w-10 items-center justify-center rounded-md border"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-4">
          {user && (
            <div className="bg-forest mb-4 flex items-center gap-3 rounded-[6px] p-3 text-white">
              <span
                className="bg-leaf font-display text-forest inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] text-base font-bold"
                aria-hidden
              >
                {initials(user.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{user.name}</span>
                <span className="flex items-center gap-1 text-sm text-white/80">
                  <MapPin size={13} aria-hidden /> {user.city}
                  {user.verified && (
                    <>
                      <span aria-hidden>·</span>
                      <BadgeCheck size={13} aria-hidden className="text-leaf" /> {t.browse.verified}
                    </>
                  )}
                </span>
              </span>
            </div>
          )}
          {user?.activeRole === "provider" ? (
            <Link
              href="/explore"
              onClick={onClose}
              className="btn bg-forest text-leaf w-full hover:brightness-110"
            >
              <Search size={18} aria-hidden /> {t.home.quick.findWork}
            </Link>
          ) : (
            <Link href="/post" onClick={onClose} className="btn btn-primary w-full">
              <Plus size={18} aria-hidden /> {t.nav.post}
            </Link>
          )}

          <nav aria-label="Primary" className="mt-4">
            <ul className="space-y-0.5">{nav.map((n) => item(n, n.href === "/messages" ? messages : 0))}</ul>
          </nav>
          {more.length > 0 && (
            <nav aria-labelledby="drawer-more" className="border-line mt-4 border-t pt-4">
              <p id="drawer-more" className="text-muted px-3 pb-1 text-xs font-bold tracking-wider uppercase">
                {t.nav.more}
              </p>
              <ul className="space-y-0.5">{more.map((n) => item(n))}</ul>
            </nav>
          )}
        </div>

        <div className="border-line bg-surface shrink-0 border-t px-4 py-3">
          <p className="text-muted pb-2 text-xs font-bold tracking-wider uppercase">{t.nav.prefs}</p>
          <div className="flex items-center justify-between gap-2">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
