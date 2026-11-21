"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  Fingerprint,
  Globe2,
  LayoutDashboard,
  LogOut,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { PASSKEY_FLAG } from "@/components/auth/login-form";
import { postJson, useI18n, useUser } from "@/components/providers";
import { useDismiss } from "@/components/use-dismiss";
import { initials } from "@/lib/format";
import type { PublicUser } from "@/lib/store/types";

/** Avatar button with account links, Hiring/Working switch, fingerprint sign-in and sign out. */
export function ProfileMenu({ user }: { user: PublicUser }) {
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
        const ok =
          typeof window.PublicKeyCredential !== "undefined" &&
          (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
        if (!ok) return setBioState("unsupported");
        setBioState(localStorage.getItem(PASSKEY_FLAG) === "1" ? "on" : "off");
      } catch {
        setBioState("unsupported");
      }
    })();
  }, [open, bioState]);

  const switchRole = async (role: "client" | "provider") => {
    if (role === user.activeRole) return;
    const r = await postJson<{ user: PublicUser }>("/api/auth/role", { role, enable: true });
    if (r.ok) {
      setUser(r.user);
      router.refresh();
    }
  };

  const enableBiometric = async () => {
    setBioState("busy");
    const o = await postJson<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"] }>(
      "/api/auth/passkey/register-options",
      {},
    );
    if (!o.ok) return setBioState("off");
    try {
      const response = await startRegistration({ optionsJSON: o.options });
      const v = await postJson("/api/auth/passkey/register-verify", {
        response,
        label: navigator.platform || "This device",
      });
      if (v.ok) {
        localStorage.setItem(PASSKEY_FLAG, "1");
        setBioState("on");
      } else setBioState("off");
    } catch {
      setBioState("off");
    }
  };

  const signOut = async () => {
    await postJson("/api/auth/logout", {});
    setUser(null);
    router.replace("/login");
    router.refresh();
  };

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
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-label={`${t.nav.profile}: ${user.name}${user.verified ? ` (${t.browse.verified})` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-accent-soft inline-flex h-10 items-center gap-1.5 rounded-md pr-1.5 pl-1"
      >
        <span
          className="bg-forest font-display relative inline-flex h-8 w-8 items-center justify-center rounded-[5px] text-sm font-bold text-white"
          aria-hidden
        >
          {initials(user.name)}
          {user.verified && (
            <BadgeCheck size={15} className="bg-bg text-accent absolute -right-1 -bottom-1 rounded-full" />
          )}
        </span>
        <ChevronDown size={14} aria-hidden className="hidden sm:block" />
      </button>

      {open && (
        <div
          ref={pop}
          role="region"
          aria-label={t.nav.profile}
          className="border-line bg-surface absolute top-12 right-0 z-50 w-[min(20rem,calc(100vw-2rem))] rounded-md border shadow-[0_12px_40px_-12px_rgba(13,26,20,.35)]"
        >
          <div className="border-line border-b p-4">
            <p className="font-display text-lg leading-tight font-bold">{user.name}</p>
            <p className="text-muted text-sm">
              {user.phoneMasked} · {user.city}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.verified ? (
                <span className="stamp">
                  <BadgeCheck size={13} aria-hidden /> {t.browse.verified}
                </span>
              ) : (
                <Link
                  href="/verification"
                  onClick={close}
                  className="text-accent text-xs font-semibold hover:underline"
                >
                  {t.verify.stampTitle} →
                </Link>
              )}
              {user.womenLed && (
                <span className="rounded-[3px] bg-[#fbe9e3] px-2 py-0.5 text-xs font-bold text-[#8a3a1d] dark:bg-[#3a1d12] dark:text-[#f0b49c]">
                  {t.browse.womenLed}
                </span>
              )}
              {user.isDemo && <span className="demo-tag">{t.common.exampleAccount}</span>}
            </div>
          </div>

          {user.roles.includes("client") && user.roles.includes("provider") && (
            <fieldset className="border-line border-b p-4">
              <legend className="text-muted mb-2 text-xs font-semibold tracking-wide uppercase">
                {t.nav.modeLabel}
              </legend>
              <div className="bg-surface-2 grid grid-cols-2 gap-1 rounded-md p-1">
                {(["client", "provider"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={user.activeRole === r}
                    onClick={() => void switchRole(r)}
                    className={`min-h-9 rounded-[5px] text-sm font-semibold transition-colors ${user.activeRole === r ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-text"}`}
                  >
                    {r === "client" ? t.nav.clientMode : t.nav.providerMode}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <ul className="p-1.5">
            {links.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={close}
                  className="hover:bg-accent-soft flex items-center gap-3 rounded px-3 py-2.5 text-[0.95rem]"
                >
                  <Icon size={18} aria-hidden className="text-muted" /> {label}
                </Link>
              </li>
            ))}
            {bioState !== "unsupported" && bioState !== "unknown" && (
              <li>
                {bioState === "on" ? (
                  <p className="text-accent flex items-center gap-3 px-3 py-2.5 text-sm">
                    <Fingerprint size={18} aria-hidden /> {t.nav.biometricOn}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void enableBiometric()}
                    disabled={bioState === "busy"}
                    className="hover:bg-accent-soft flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-[0.95rem]"
                  >
                    <Fingerprint size={18} aria-hidden className="text-muted" /> {t.nav.biometricSetup}
                  </button>
                )}
              </li>
            )}
            <li className="border-line mt-1 border-t pt-1">
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-danger hover:bg-danger-soft flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-[0.95rem]"
              >
                <LogOut size={18} aria-hidden /> {t.nav.signOut}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
