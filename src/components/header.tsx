"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell, ChevronDown, ChevronRight, Compass, MessageCircleQuestion, Fingerprint, Globe2, LogOut, MapPin, Menu, MessageSquare, Plus,
  Search, ShieldAlert, ShieldCheck, BadgeCheck, UserRound, Users, Wallet, X, ClipboardList, LayoutDashboard, Check,
} from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { Logo } from "./logo";
import { CategoriesMenu } from "./categories-menu";
import { LangSwitch, ThemeToggle } from "./prefs-controls";
import { postJson, useCity, useI18n, useUser } from "./providers";
import { ANYWHERE, CITY_COORDS, HEADER_CITIES } from "@/lib/geo";
import { eventText } from "@/lib/events";
import { npDate } from "@/lib/format";
import { useDismiss } from "./use-dismiss";
import { PASSKEY_FLAG } from "./auth/login-form";
import type { PublicUser } from "@/lib/store/types";


export function Header() {
  const { t } = useI18n();
  const { user } = useUser();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const badges = useBadges(!!user);

  useEffect(() => { setDrawer(false); setSearchOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  // The top bar follows the mode: hiring shows hiring links, working shows work links.
  const working = user?.activeRole === "provider";
  const nav = useMemo(() => working ? [
    { href: "/explore", label: t.home.quick.findWork, Icon: Search },
    { href: "/my-tasks", label: t.home.quick.myOffers, Icon: ClipboardList },
    { href: "/wallet", label: t.home.quick.earnings, Icon: Wallet },
    { href: "/messages", label: t.nav.messages, Icon: MessageSquare },
  ] : [
    { href: "/explore", label: t.home.landing.navBrowse, Icon: Compass },
    { href: "/professionals", label: t.nav.professionals, Icon: Users },
    { href: "/my-tasks", label: t.nav.myTasks, Icon: ClipboardList },
    { href: "/messages", label: t.nav.messages, Icon: MessageSquare },
  ], [t, working]);

  const closeDrawer = useCallback(() => setDrawer(false), []);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <a href="#main" className="skip-link">{t.nav.skip}</a>
      <div className="mx-auto flex h-[var(--header-h)] max-w-[88rem] items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          className="-ml-1 inline-flex h-10 w-10 items-center justify-center rounded-md xl:hidden"
          aria-label={t.nav.menu}
          aria-expanded={drawer}
          aria-controls="mobile-drawer"
          onClick={() => setDrawer(true)}
        >
          <Menu size={22} aria-hidden />
        </button>

        <Logo />

        <CityPicker />

        <nav aria-label="Primary" className="ml-1 hidden items-center gap-0.5 xl:flex">
          <CategoriesMenu />
          {nav.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={`relative whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] font-semibold transition-colors hover:text-accent ${isActive(href) ? "text-accent" : "text-text"}`}
            >
              {label}
              {href === "/messages" && <CountBadge n={badges.messages} label={t.msg.title} />}
              {isActive(href) && <span className="absolute inset-x-3 -bottom-[13px] h-[3px] bg-accent" aria-hidden />}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <form action="/explore" role="search" className="relative hidden 2xl:block">
            <label htmlFor="hdr-q" className="sr-only">{t.nav.search}</label>
            <Search size={17} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input id="hdr-q" name="q" type="search" placeholder={t.nav.search} maxLength={80}
              className="input !min-h-10 w-64 !pl-9 !text-[0.95rem]" />
          </form>
          <button type="button" className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-md border border-line-strong px-2.5 font-semibold hover:border-accent hover:bg-accent-soft 2xl:hidden"
            aria-expanded={searchOpen} aria-controls="hdr-search" onClick={() => setSearchOpen((s) => !s)}>
            <Search size={19} aria-hidden /> <span className="sr-only sm:not-sr-only">{t.nav.searchShort}</span>
          </button>

          {working ? (
            <Link href="/explore" className="btn hidden !min-h-10 !px-3.5 bg-forest text-leaf hover:brightness-110 md:inline-flex">
              <Search size={18} aria-hidden /> {t.home.quick.findWork}
            </Link>
          ) : (
            <Link href="/post" className="btn btn-primary hidden !min-h-10 !px-3.5 md:inline-flex">
              <Plus size={18} aria-hidden /> {t.nav.post}
            </Link>
          )}

          <div className="hidden sm:block"><LangSwitch /></div>
          <div className="hidden md:block"><ThemeToggle /></div>
          <Notifications badges={badges} />
          {user && <ProfileMenu user={user} />}
        </div>
      </div>

      {searchOpen && (
        <form id="hdr-search" action="/explore" role="search" className="flex gap-2 border-t border-line px-4 py-3 2xl:hidden">
          <label htmlFor="hdr-q-m" className="sr-only">{t.nav.search}</label>
          <input id="hdr-q-m" name="q" type="search" autoFocus placeholder={t.nav.search} maxLength={80} className="input !min-h-11" />
          <button type="submit" className="btn btn-primary !min-h-11 shrink-0"><Search size={18} aria-hidden /> <span className="sr-only sm:not-sr-only">{t.nav.searchShort}</span></button>
        </form>
      )}

      {drawer && <MobileDrawer nav={nav} onClose={closeDrawer} isActive={isActive} user={user} messages={badges.messages} />}
    </header>
  );
}

/* ------------------------------------------------------------ city picker */
function CityPicker() {
  const { t } = useI18n();
  const { city, setCity } = useCity();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useCallback(() => { setOpen(false); setQ(""); }, []);
  const refs = useMemo(() => [btn, pop], []);
  useDismiss(open, close, refs, btn);

  const choose = (c: string) => {
    setCity(c); close(); btn.current?.focus();
  };
  // Typing searches every known city, not only the short list.
  const all = useMemo(() => [...new Set<string>([...HEADER_CITIES.filter((c) => c !== "Online"), ...Object.keys(CITY_COORDS).sort()])], []);
  const query = q.trim().toLowerCase();
  const cities = query ? all.filter((c) => c.toLowerCase().includes(query)) : HEADER_CITIES.filter((c) => c !== "Online");
  const showOnline = !query || t.nav.onlineWork.toLowerCase().includes(query) || "online".includes(query);
  const label = city === ANYWHERE ? t.nav.anywhere : city === "Online" ? t.nav.onlineWork : city;

  const row = (value: string, content: React.ReactNode) => (
    <li key={value} role="option" aria-selected={value === city}>
      <button type="button" onClick={() => choose(value)}
        className={`flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-[0.95rem] hover:bg-accent-soft ${value === city ? "font-semibold text-accent" : ""}`}>
        {content}
        {value === city && <Check size={16} aria-hidden className="shrink-0" />}
      </button>
    </li>
  );

  return (
    <div className="relative hidden sm:block">
      <button ref={btn} type="button" aria-expanded={open} aria-haspopup="listbox"
        aria-label={`${t.nav.city}: ${label}`}
        onClick={() => (open ? close() : setOpen(true))}
        className="inline-flex h-10 items-center gap-1.5 rounded-md border border-line px-2.5 text-sm font-semibold hover:border-accent">
        {city === ANYWHERE ? <Globe2 size={16} aria-hidden className="text-accent" /> : <MapPin size={16} aria-hidden className="text-accent" />}
        <span className="max-w-32 truncate">{label}</span>
        <ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div ref={pop} className="absolute left-0 top-12 z-50 w-72 rounded-md border border-line bg-surface p-1.5 shadow-[0_12px_40px_-12px_rgba(13,26,20,.35)]">
          <button type="button" onClick={() => choose(ANYWHERE)}
            className={`flex w-full items-center gap-3 rounded-md p-3 text-left ${city === ANYWHERE ? "bg-accent text-accent-contrast" : "bg-accent-soft hover:brightness-95"}`}>
            <Globe2 size={20} aria-hidden className="shrink-0" />
            <span className="flex-1">
              <span className="block font-semibold">{t.nav.anywhere}</span>
              <span className={`block text-xs ${city === ANYWHERE ? "opacity-90" : "text-muted"}`}>{t.nav.anywhereNote}</span>
            </span>
            {city === ANYWHERE && <Check size={16} aria-hidden />}
          </button>
          <label className="relative mt-1.5 block">
            <span className="sr-only">{t.nav.findCity}</span>
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.nav.findCity} maxLength={40}
              onKeyDown={(e) => { if (e.key === "Enter" && cities[0]) { e.preventDefault(); choose(cities[0]); } }}
              className="input !min-h-10 !pl-9 !text-[0.95rem]" />
          </label>
          <ul role="listbox" aria-label={t.nav.city} className="mt-1 max-h-64 overflow-auto">
            {cities.map((c) => row(c, c))}
            {showOnline && row("Online", <span className="inline-flex items-center gap-2"><Globe2 size={15} aria-hidden />{t.nav.onlineWork}</span>)}
            {cities.length === 0 && !showOnline && <li className="px-3 py-3 text-sm text-muted">{t.nav.noCity}</li>}
          </ul>
          <Link href="/location" onClick={close} className="mt-1 flex items-center gap-2 border-t border-line px-3 py-2.5 text-sm font-semibold text-accent hover:underline">
            <MapPin size={15} aria-hidden /> {t.location.title}
          </Link>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- notifications */
interface NotifItem { id: string; kind: string; code: string; params: Record<string, string | number>; href: string; read: boolean; at: string }
interface Badges { unread: number; messages: number; items: NotifItem[] }

/** Polls notification + unread-message counts (every 20 s, and on navigation). */
function useBadges(enabled: boolean) {
  const pathname = usePathname();
  const [b, setB] = useState<Badges>({ unread: 0, messages: 0, items: [] });
  const load = useCallback(async () => {
    const r = await fetch("/api/notifications", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
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

function CountBadge({ n, label }: { n: number; label: string }) {
  if (!n) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-clay px-1 text-[0.65rem] font-bold leading-[1.15rem] text-white">
      {n > 9 ? "9+" : n}<span className="sr-only"> {label}</span>
    </span>
  );
}

function Notifications({ badges }: { badges: Badges & { reload: () => Promise<void> } }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const refs = useMemo(() => [btn, pop], []);
  useDismiss(open, close, refs, btn);

  const markAll = async () => { await postJson("/api/notifications", { action: "read_all" }); await badges.reload(); };

  return (
    <div className="relative">
      <button ref={btn} type="button" aria-expanded={open} aria-label={`${t.nav.notifications}${badges.unread ? ` (${t.notif.unread(badges.unread)})` : ""}`}
        onClick={() => { setOpen((o) => !o); void badges.reload(); }}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent-soft">
        <Bell size={20} aria-hidden />
        <CountBadge n={badges.unread} label={t.notif.unread(badges.unread)} />
      </button>
      {open && (
        <div ref={pop} role="region" aria-label={t.nav.notifications}
          className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-md border border-line bg-surface shadow-[0_12px_40px_-12px_rgba(13,26,20,.35)]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="font-display text-base font-bold">{t.notif.title}</h2>
            {badges.unread > 0 && <button type="button" onClick={() => void markAll()} className="text-sm font-semibold text-accent hover:underline">{t.notif.markAll}</button>}
          </div>
          {badges.items.length === 0 ? (
            <p className="p-4 text-sm text-muted">{t.notif.none}</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {badges.items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => { setOpen(false); router.push(n.href); }}
                    className={`flex w-full items-start gap-2.5 border-b border-line px-4 py-3 text-left text-sm hover:bg-accent-soft ${n.read ? "text-muted" : ""}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.read ? "" : "font-semibold"}`}>{eventText(t, lang, n.code, n.params)}</span>
                      {typeof n.params.task === "string" && n.params.task && <span className="block truncate text-xs text-muted">{n.params.task}</span>}
                      <span className="block text-xs text-muted">{npDate(n.at, lang, { time: true })}</span>
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

/* ----------------------------------------------------------- profile menu */
function ProfileMenu({ user }: { user: PublicUser }) {
  const { t } = useI18n();
  const { setUser } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bioState, setBioState] = useState<"unknown" | "unsupported" | "off" | "on" | "busy">("unknown");
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const refs = useMemo(() => [btn, pop], []);
  useDismiss(open, close, refs, btn);

  useEffect(() => {
    if (!open || bioState !== "unknown") return;
    (async () => {
      try {
        const ok = typeof window.PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
        if (!ok) return setBioState("unsupported");
        setBioState(localStorage.getItem(PASSKEY_FLAG) === "1" ? "on" : "off");
      } catch { setBioState("unsupported"); }
    })();
  }, [open, bioState]);

  const switchRole = async (role: "client" | "provider") => {
    if (role === user.activeRole) return;
    const r = await postJson<{ user: PublicUser }>("/api/auth/role", { role, enable: true });
    if (r.ok) { setUser(r.user); router.refresh(); }
  };

  const enableBiometric = async () => {
    setBioState("busy");
    const o = await postJson<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>("/api/auth/passkey/register-options", {});
    if (!o.ok) return setBioState("off");
    try {
      const response = await startRegistration({ optionsJSON: o.options });
      const v = await postJson("/api/auth/passkey/register-verify", { response, label: navigator.platform || "This device" });
      if (v.ok) { localStorage.setItem(PASSKEY_FLAG, "1"); setBioState("on"); } else setBioState("off");
    } catch { setBioState("off"); }
  };

  const signOut = async () => {
    await postJson("/api/auth/logout", {});
    setUser(null);
    router.replace("/login");
    router.refresh();
  };

  const initials = user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const links = [
    { href: "/my-tasks", label: t.nav.myTasks, Icon: LayoutDashboard },
    { href: "/wallet", label: t.nav.wallet, Icon: Wallet },
    { href: "/verification", label: t.nav.verification, Icon: ShieldCheck },
    { href: "/location", label: t.location.title, Icon: MapPin },
    { href: "/abroad", label: t.nav.abroad, Icon: Globe2 },
    { href: "/safety", label: t.nav.safety, Icon: ShieldAlert },
    ...(user.isAdmin ? [{ href: "/admin", label: t.nav.admin, Icon: UserRound }] : []),
  ];

  return (
    <div className="relative">
      <button ref={btn} type="button" aria-expanded={open} aria-label={`${t.nav.profile}: ${user.name}${user.verified ? ` (${t.browse.verified})` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-10 items-center gap-1.5 rounded-md pl-1 pr-1.5 hover:bg-accent-soft">
        <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-[5px] bg-forest font-display text-sm font-bold text-white" aria-hidden>
          {initials}
          {user.verified && <BadgeCheck size={15} className="absolute -bottom-1 -right-1 rounded-full bg-bg text-accent" />}
        </span>
        <ChevronDown size={14} aria-hidden className="hidden sm:block" />
      </button>

      {open && (
        <div ref={pop} role="region" aria-label={t.nav.profile}
          className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-line bg-surface shadow-[0_12px_40px_-12px_rgba(13,26,20,.35)]">
          <div className="border-b border-line p-4">
            <p className="font-display text-lg font-bold leading-tight">{user.name}</p>
            <p className="text-sm text-muted">{user.phoneMasked} · {user.city}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.verified
                ? <span className="stamp"><BadgeCheck size={13} aria-hidden /> {t.browse.verified}</span>
                : <Link href="/verification" onClick={close} className="text-xs font-semibold text-accent hover:underline">{t.verify.stampTitle} →</Link>}
              {user.womenLed && <span className="rounded-[3px] bg-[#fbe9e3] px-2 py-0.5 text-xs font-bold text-[#8a3a1d] dark:bg-[#3a1d12] dark:text-[#f0b49c]">{t.browse.womenLed}</span>}
              {user.isDemo && <span className="demo-tag">{t.common.exampleAccount}</span>}
            </div>
          </div>

          {user.roles.includes("client") && user.roles.includes("provider") && <fieldset className="border-b border-line p-4">
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t.nav.modeLabel}</legend>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-surface-2 p-1">
              {(["client", "provider"] as const).map((r) => (
                <button key={r} type="button" aria-pressed={user.activeRole === r} onClick={() => void switchRole(r)}
                  className={`min-h-9 rounded-[5px] text-sm font-semibold transition-colors ${user.activeRole === r ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-text"}`}>
                  {r === "client" ? t.nav.clientMode : t.nav.providerMode}
                </button>
              ))}
            </div>
          </fieldset>}

          <ul className="p-1.5">
            {links.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link href={href} onClick={close} className="flex items-center gap-3 rounded px-3 py-2.5 text-[0.95rem] hover:bg-accent-soft">
                  <Icon size={18} aria-hidden className="text-muted" /> {label}
                </Link>
              </li>
            ))}
            {bioState !== "unsupported" && bioState !== "unknown" && (
              <li>
                {bioState === "on" ? (
                  <p className="flex items-center gap-3 px-3 py-2.5 text-sm text-accent"><Fingerprint size={18} aria-hidden /> {t.nav.biometricOn}</p>
                ) : (
                  <button type="button" onClick={() => void enableBiometric()} disabled={bioState === "busy"}
                    className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-[0.95rem] hover:bg-accent-soft">
                    <Fingerprint size={18} aria-hidden className="text-muted" /> {t.nav.biometricSetup}
                  </button>
                )}
              </li>
            )}
            <li className="mt-1 border-t border-line pt-1">
              <button type="button" onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-[0.95rem] text-danger hover:bg-danger-soft">
                <LogOut size={18} aria-hidden /> {t.nav.signOut}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- mobile drawer
   Rendered into <body> through a portal: the header's backdrop-blur would otherwise
   trap a position:fixed child inside the 68px header strip. */
function MobileDrawer({ nav, onClose, isActive, user, messages }: {
  nav: { href: string; label: string; Icon: typeof Compass }[]; onClose: () => void; isActive: (h: string) => boolean;
  user: PublicUser | null; messages: number;
}) {
  const { t } = useI18n();
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!mounted) return;
    panel.current?.querySelector<HTMLElement>("button")?.focus(); // the close button
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      // keep keyboard focus inside the open menu
      const f = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, mounted]);
  if (!mounted) return null;

  const more = user ? [
    { href: "/wallet", label: t.nav.wallet, Icon: Wallet },
    { href: "/verification", label: t.nav.verification, Icon: ShieldCheck },
    { href: "/abroad", label: t.nav.abroad, Icon: Globe2 },
    { href: "/safety", label: t.nav.safety, Icon: ShieldAlert },
    { href: "/contact", label: t.footer.contact, Icon: MessageCircleQuestion },
    ...(user.isAdmin ? [{ href: "/admin", label: t.nav.admin, Icon: UserRound }] : []),
  ] : [];
  const initials = user ? user.name.split(/s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase() : "";

  const item = ({ href, label, Icon }: { href: string; label: string; Icon: typeof Compass }, badge = 0) => {
    const active = isActive(href);
    return (
      <li key={href}>
        <Link href={href} onClick={onClose} aria-current={active ? "page" : undefined}
          className={`relative flex min-h-12 items-center gap-3 rounded-md px-3 font-semibold transition-colors ${active ? "bg-accent-soft text-accent" : "text-text hover:bg-accent-soft"}`}>
          {active && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
          <Icon size={20} aria-hidden className={active ? "text-accent" : "text-muted"} />
          <span className="flex-1">{label}</span>
          {badge > 0 && <span className="rounded-full bg-clay px-2 py-0.5 text-xs font-bold text-white">{badge > 9 ? "9+" : badge}<span className="sr-only"> {t.msg.title}</span></span>}
          <ChevronRight size={16} aria-hidden className="text-muted" />
        </Link>
      </li>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] xl:hidden" role="dialog" aria-modal="true" aria-label={t.nav.menu} id="mobile-drawer">
      <button type="button" className="drawer-fade absolute inset-0 bg-ink/55 backdrop-blur-[2px]" aria-label={t.common.close} onClick={onClose} tabIndex={-1} />
      <div ref={panel} className="drawer-slide absolute inset-y-0 left-0 flex w-[min(21rem,88vw)] flex-col border-r border-line bg-bg shadow-2xl">
        <div className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-line px-4">
          <Logo />
          <button type="button" onClick={onClose} aria-label={t.common.close} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line hover:bg-accent-soft">
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-4">
          {user && (
            <div className="mb-4 flex items-center gap-3 rounded-[6px] bg-forest p-3 text-white">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[6px] bg-leaf font-display text-base font-bold text-forest" aria-hidden>{initials}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{user.name}</span>
                <span className="flex items-center gap-1 text-sm text-white/80"><MapPin size={13} aria-hidden /> {user.city}
                  {user.verified && <><span aria-hidden>·</span><BadgeCheck size={13} aria-hidden className="text-leaf" /> {t.browse.verified}</>}
                </span>
              </span>
            </div>
          )}
          {user?.activeRole === "provider"
            ? <Link href="/explore" onClick={onClose} className="btn w-full bg-forest text-leaf hover:brightness-110"><Search size={18} aria-hidden /> {t.home.quick.findWork}</Link>
            : <Link href="/post" onClick={onClose} className="btn btn-primary w-full"><Plus size={18} aria-hidden /> {t.nav.post}</Link>}

          <nav aria-label="Primary" className="mt-4">
            <ul className="space-y-0.5">{nav.map((n) => item(n, n.href === "/messages" ? messages : 0))}</ul>
          </nav>
          {more.length > 0 && (
            <nav aria-labelledby="drawer-more" className="mt-4 border-t border-line pt-4">
              <p id="drawer-more" className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-muted">{t.nav.more}</p>
              <ul className="space-y-0.5">{more.map((n) => item(n))}</ul>
            </nav>
          )}
        </div>

        <div className="shrink-0 border-t border-line bg-surface px-4 py-3">
          <p className="pb-2 text-xs font-bold uppercase tracking-wider text-muted">{t.nav.prefs}</p>
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
