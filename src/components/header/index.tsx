"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Menu, Plus, Search } from "lucide-react";
import { CategoriesMenu } from "@/components/categories-menu";
import { Logo } from "@/components/logo";
import { LangSwitch, ThemeToggle } from "@/components/prefs-controls";
import { useI18n, useUser } from "@/components/providers";
import { CityPicker } from "./city-picker";
import { MobileDrawer } from "./mobile-drawer";
import { primaryNav } from "./nav-links";
import { CountBadge, Notifications, useBadges } from "./notifications";
import { ProfileMenu } from "./profile-menu";

/** Sticky top bar shown on every page: logo, city, main links, search, notifications and profile. */
export function Header() {
  const { t } = useI18n();
  const { user } = useUser();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const badges = useBadges(!!user);

  // Close the menu and search bar after moving to another page.
  useEffect(() => {
    setDrawer(false);
    setSearchOpen(false);
  }, [pathname]);

  // Stop the page behind the open menu from scrolling.
  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer]);

  const working = user?.activeRole === "provider";
  const nav = useMemo(() => primaryNav(t, working), [t, working]);

  const closeDrawer = useCallback(() => setDrawer(false), []);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-line bg-bg/90 supports-[backdrop-filter]:bg-bg/75 sticky top-0 z-40 border-b backdrop-blur">
      <a href="#main" className="skip-link">
        {t.nav.skip}
      </a>
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
              className={`hover:text-accent relative rounded-md px-3 py-2 text-[0.95rem] font-semibold whitespace-nowrap transition-colors ${isActive(href) ? "text-accent" : "text-text"}`}
            >
              {label}
              {href === "/messages" && <CountBadge n={badges.messages} label={t.msg.title} />}
              {isActive(href) && (
                <span className="bg-accent absolute inset-x-3 -bottom-[13px] h-[3px]" aria-hidden />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Wide screens: search box always visible */}
          <form action="/explore" role="search" className="relative hidden 2xl:block">
            <label htmlFor="hdr-q" className="sr-only">
              {t.nav.search}
            </label>
            <Search
              size={17}
              aria-hidden
              className="text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              id="hdr-q"
              name="q"
              type="search"
              placeholder={t.nav.search}
              maxLength={80}
              className="input !min-h-10 w-64 !pl-9 !text-[0.95rem]"
            />
          </form>
          {/* Smaller screens: a button that opens the search bar below the header */}
          <button
            type="button"
            className="border-line-strong hover:border-accent hover:bg-accent-soft inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-md border px-2.5 font-semibold 2xl:hidden"
            aria-expanded={searchOpen}
            aria-controls="hdr-search"
            onClick={() => setSearchOpen((s) => !s)}
          >
            <Search size={19} aria-hidden />{" "}
            <span className="sr-only sm:not-sr-only">{t.nav.searchShort}</span>
          </button>

          {working ? (
            <Link
              href="/explore"
              className="btn bg-forest text-leaf hidden !min-h-10 !px-3.5 hover:brightness-110 md:inline-flex"
            >
              <Search size={18} aria-hidden /> {t.home.quick.findWork}
            </Link>
          ) : (
            <Link href="/post" className="btn btn-primary hidden !min-h-10 !px-3.5 md:inline-flex">
              <Plus size={18} aria-hidden /> {t.nav.post}
            </Link>
          )}

          <div className="hidden sm:block">
            <LangSwitch />
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <Notifications badges={badges} />
          {user && <ProfileMenu user={user} />}
        </div>
      </div>

      {searchOpen && (
        <form
          id="hdr-search"
          action="/explore"
          role="search"
          className="border-line flex gap-2 border-t px-4 py-3 2xl:hidden"
        >
          <label htmlFor="hdr-q-m" className="sr-only">
            {t.nav.search}
          </label>
          <input
            id="hdr-q-m"
            name="q"
            type="search"
            autoFocus
            placeholder={t.nav.search}
            maxLength={80}
            className="input !min-h-11"
          />
          <button type="submit" className="btn btn-primary !min-h-11 shrink-0">
            <Search size={18} aria-hidden />{" "}
            <span className="sr-only sm:not-sr-only">{t.nav.searchShort}</span>
          </button>
        </form>
      )}

      {drawer && (
        <MobileDrawer
          nav={nav}
          onClose={closeDrawer}
          isActive={isActive}
          user={user}
          messages={badges.messages}
        />
      )}
    </header>
  );
}
