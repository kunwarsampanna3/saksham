"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { dicts, type Dict, type Lang } from "@/lib/i18n/dict";
import type { PublicUser } from "@/lib/store/types";
import type { ThemePref } from "@/lib/i18n/server";

/* ------------------------------------------------------------------ i18n */
interface I18n { lang: Lang; t: Dict; setLang: (l: Lang) => void }
const I18nCtx = createContext<I18n | null>(null);
export function useI18n() {
  const v = useContext(I18nCtx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}

/* ----------------------------------------------------------------- theme */
interface Theme { pref: ThemePref; resolved: "light" | "dark"; setPref: (p: ThemePref) => void }
const ThemeCtx = createContext<Theme | null>(null);
export function useTheme() {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error("useTheme outside provider");
  return v;
}

/* ------------------------------------------------------------------ user */
interface UserCtxV { user: PublicUser | null; setUser: (u: PublicUser | null) => void }
const UserCtx = createContext<UserCtxV | null>(null);
export function useUser() {
  const v = useContext(UserCtx);
  if (!v) throw new Error("useUser outside provider");
  return v;
}

/* ------------------------------------------------------------------ city */
interface CityV { city: string; setCity: (c: string) => void }
const CityCtx = createContext<CityV | null>(null);
export function useCity() {
  const v = useContext(CityCtx);
  if (!v) throw new Error("useCity outside provider");
  return v;
}

/** Small JSON POST helper used by every client form. Never throws; returns the parsed body. */
export async function postJson<T = Record<string, unknown>>(url: string, body: unknown): Promise<T & { ok: boolean; error?: string; status: number }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    return { ...(data as T), ok: res.ok && (data as { ok?: boolean }).ok !== false, status: res.status };
  } catch {
    return { ok: false, error: "offline", status: 0 } as T & { ok: boolean; error: string; status: number };
  }
}

export function Providers({
  children, initialLang, initialTheme, initialUser, initialCity,
}: { children: ReactNode; initialLang: Lang; initialTheme: ThemePref; initialUser: PublicUser | null; initialCity: string }) {
  const router = useRouter();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [pref, setPrefState] = useState<ThemePref>(initialTheme);
  const [systemDark, setSystemDark] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(initialUser);

  const [city, setCityState] = useState(initialCity);
  useEffect(() => setUser(initialUser), [initialUser]);

  const setCity = useCallback((c: string) => {
    setCityState(c);
    document.cookie = `city=${encodeURIComponent(c)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh(); // server sections (e.g. tasks near you) re-render for the new city
  }, [router]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const resolved: "light" | "dark" = pref === "system" ? (systemDark ? "dark" : "light") : pref;
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    void postJson("/api/prefs", { lang: l }).then(() => router.refresh());
  }, [router]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    void postJson("/api/prefs", { theme: p });
  }, []);

  const i18n = useMemo(() => ({ lang, t: dicts[lang], setLang }), [lang, setLang]);
  const theme = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved, setPref]);
  const userV = useMemo(() => ({ user, setUser }), [user]);
  const cityV = useMemo(() => ({ city, setCity }), [city, setCity]);

  return (
    <I18nCtx.Provider value={i18n}>
      <ThemeCtx.Provider value={theme}>
        <UserCtx.Provider value={userV}>
          <CityCtx.Provider value={cityV}>{children}</CityCtx.Provider>
        </UserCtx.Provider>
      </ThemeCtx.Provider>
    </I18nCtx.Provider>
  );
}
