import Link from "next/link";
import { ArrowRight, BadgeCheck, Languages, LockKeyhole, Scale } from "lucide-react";
import { CATEGORY_ICONS } from "@/components/browse/cards";
import { ProviderButton } from "@/components/home/provider-button";
import { TaskBox } from "@/components/home/task-box";
import { Logo } from "@/components/logo";
import { CategoriesMenu } from "@/components/categories-menu";
import { LangSwitch, ThemeToggle } from "@/components/prefs-controls";
import { CATEGORIES, fairRange, type CategoryId } from "@/lib/pricing";
import { num } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dict";

type P = { t: Dict; lang: Lang };

/** Stacked terrace bands used as the hero's side art (Saksham's own motif). */
function Terraces({ flip = false }: { flip?: boolean }) {
  const bands = [92, 74, 58, 44, 32];
  return (
    <div aria-hidden className={`pointer-events-none absolute bottom-0 hidden w-[22%] flex-col gap-2 md:flex ${flip ? "right-0 items-end" : "left-0 items-start"}`}>
      {bands.map((w, i) => (
        <div key={w} className="rise h-4 rounded-sm lg:h-5"
          style={{ width: `${w}%`, background: i % 2 ? "var(--paddy)" : "var(--leaf)", opacity: 0.9 - i * 0.12, ["--delay" as string]: `${0.6 + i * 0.1}s` }} />
      )).reverse()}
    </div>
  );
}

/* ================================================================ hero */
export function LandingHero({ t, lang, name, isProvider, visitor = false }: P & { name?: string; isProvider?: boolean; visitor?: boolean }) {
  const l = t.home.landing;
  const icons = [Scale, LockKeyhole, Languages, BadgeCheck];
  return (
    <section aria-labelledby="hero-h" className="mx-auto max-w-[88rem] px-3 pt-4 sm:px-6 sm:pt-6">
      <div className="relative overflow-hidden rounded-[18px] bg-forest px-5 pb-10 pt-10 text-white sm:px-10 sm:pb-12 sm:pt-14">
        <Terraces />
        <Terraces flip />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="rise text-sm font-semibold text-white/75" style={{ ["--delay" as string]: "0.1s" }}>{name ? `${t.home.hello(name)} · ` : ""}{t.home.hero.eyebrow}</p>
          <h1 id="hero-h" lang={lang}
            className={`rise font-display mt-3 font-extrabold tracking-tight ${lang === "ne"
              ? "text-[2.6rem] leading-[1.25] xs:text-[3rem] sm:text-6xl lg:text-[5.2rem]"
              : "text-[3rem] uppercase leading-[0.92] xs:text-[3.6rem] sm:text-7xl lg:text-[6.5rem]"}`}
            style={{ ["--delay" as string]: "0.2s" }}>
            {l.title}
          </h1>
          <p className="rise font-display mt-2 text-2xl font-bold text-leaf sm:text-3xl" style={{ ["--delay" as string]: "0.3s" }}>
            {t.home.hero.line1} {t.home.hero.line2}
          </p>
          <p className="rise mx-auto mt-4 max-w-2xl text-lg text-white/85 sm:text-xl" style={{ ["--delay" as string]: "0.4s" }}>{l.pitch}</p>
          <div className="rise mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ ["--delay" as string]: "0.5s" }}>
            <Link href={visitor ? "/signup" : "/post"} className="btn !min-h-12 rounded-full bg-leaf px-6 text-base font-bold text-forest hover:brightness-105">
              {visitor ? l.join : l.post} <ArrowRight size={18} aria-hidden />
            </Link>
            {visitor
              ? <Link href="/login" className="btn !min-h-12 rounded-full border-2 border-white/70 px-6 text-base font-bold text-white hover:bg-white/10">{l.signIn}</Link>
              : isProvider
              ? <Link href="/explore" className="btn !min-h-12 rounded-full border-2 border-white/70 px-6 text-base font-bold text-white hover:bg-white/10">{l.earn} <ArrowRight size={18} aria-hidden /></Link>
              : <ProviderButton label={l.earn} className="btn !min-h-12 rounded-full border-2 border-white/70 px-6 text-base font-bold text-white hover:bg-white/10" />}
          </div>
          <ul className="rise mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-semibold text-white/85" style={{ ["--delay" as string]: "0.6s" }}>
            {l.facts.map((f, i) => {
              const Icon = icons[i] ?? BadgeCheck;
              return <li key={f} className="inline-flex items-center gap-1.5"><Icon size={16} aria-hidden className="text-leaf" /> {f}</li>;
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ post your first task */
const FEATURED: CategoryId[] = ["web-design", "coding", "it-support", "phone-repair", "tutoring", "tailoring", "plumbing", "cleaning"];

export function FirstTask({ t, lang }: P) {
  const l = t.home.landing;
  const q = t.home.quick;
  return (
    <section aria-labelledby="first-h" className="mx-auto grid max-w-[88rem] items-start gap-10 px-4 pt-16 sm:px-6 lg:grid-cols-12 lg:pt-24">
      <div className="lg:col-span-5">
        <h2 id="first-h" className="font-display text-[2.1rem] font-extrabold leading-tight sm:text-5xl" lang={lang}>{l.firstTitle}</h2>
        <p className="mt-3 text-lg text-muted">{l.firstLead}</p>
        <ol className="mt-6 space-y-3">
          {l.steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 text-[1.05rem] font-semibold">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft font-bold text-accent" aria-hidden>{i + 1}</span>{s}
            </li>
          ))}
        </ol>
        <div className="mt-7"><TaskBox /></div>
      </div>

      <div className="rounded-[16px] bg-accent-soft p-3 sm:p-5 lg:col-span-7">
        <ul className="grid gap-3 sm:grid-cols-2">
          {FEATURED.map((id) => {
            const c = CATEGORIES.find((x) => x.id === id)!;
            const Icon = CATEGORY_ICONS[id];
            return (
              <li key={id}>
                <Link href={`/explore?category=${id}`}
                  className="group flex items-center gap-3 rounded-[12px] border border-line bg-surface p-3 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(13,26,20,.35)]">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none">
                    <Icon size={24} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold leading-tight">{q.short[id]}</span>
                    <span className="block truncate text-sm text-muted">{lang === "ne" ? c.ne : c.en} · {l.catHint(num(fairRange({ category: id, days: 1 }).low, lang))}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link href="/explore" className="mt-4 inline-flex items-center gap-1.5 px-2 font-semibold text-accent hover:underline">{l.allCats} <ArrowRight size={16} aria-hidden /></Link>
      </div>
    </section>
  );
}

/* ================================================================ visitor (signed-out) pieces */
export function PublicHeader({ t }: { t: Dict }) {
  const l = t.home.landing;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <a href="#main" className="skip-link">{t.nav.skip}</a>
      <div className="mx-auto flex h-[var(--header-h)] max-w-[88rem] items-center gap-3 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="ml-2 hidden items-center gap-1 md:flex">
          <CategoriesMenu />
          <Link href="/explore" className="rounded-md px-3 py-2 text-[0.95rem] font-semibold hover:text-accent">{l.navBrowse}</Link>
          <a href="#how" className="rounded-md px-3 py-2 text-[0.95rem] font-semibold hover:text-accent">{l.navHow}</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block"><LangSwitch /></div>
          <div className="hidden md:block"><ThemeToggle /></div>
          <Link href="/login" className="btn btn-ghost !min-h-10 !px-3">{l.signIn}</Link>
          <Link href="/signup" className="btn btn-primary !min-h-10 !px-3">
            <span className="sm:hidden">{l.joinShort}</span><span className="hidden sm:inline">{l.join}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/** All skills as big tappable cards (signed-out visitors land on sign-in, then the filtered list). */
export function AllCategories({ t, lang }: P) {
  const l = t.home.landing;
  const q = t.home.quick;
  return (
    <section id="cats" aria-labelledby="cats-h" className="mx-auto max-w-[88rem] scroll-mt-20 px-4 pt-16 sm:px-6 lg:pt-24">
      <h2 id="cats-h" className="font-display text-[2.1rem] font-extrabold leading-tight sm:text-5xl" lang={lang}>{l.catsTitle}</h2>
      <p className="mt-2 text-lg text-muted">{l.catsLead}</p>
      <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.filter((c) => c.id !== "other").slice(0, 15).map((c) => {
          const Icon = CATEGORY_ICONS[c.id];
          return (
            <li key={c.id}>
              <Link href={`/explore?category=${c.id}`}
                className="group flex h-full flex-col gap-3 rounded-[12px] border border-line bg-surface p-4 transition-shadow hover:border-accent hover:shadow-[0_8px_24px_-12px_rgba(13,26,20,.35)]">
                <span className="grid h-12 w-12 place-items-center rounded-[10px] bg-accent-soft text-accent transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none">
                  <Icon size={24} strokeWidth={1.8} aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold leading-tight">{q.short[c.id]}</span>
                  <span className="block text-sm text-muted">{l.catHint(num(fairRange({ category: c.id, days: 1 }).low, lang))}</span>
                </span>
              </Link>
            </li>
          );
        })}
        <li>
          <a href="#topcat-h" className="flex h-full min-h-[7.5rem] flex-col justify-between rounded-[12px] bg-forest p-4 text-white hover:brightness-110">
            <ArrowRight size={24} aria-hidden className="text-leaf" />
            <span className="font-semibold">{l.allCats}</span>
          </a>
        </li>
      </ul>
    </section>
  );
}

export function FinalCta({ t, lang }: P) {
  const l = t.home.landing;
  return (
    <section aria-labelledby="final-h" className="mx-auto max-w-[88rem] px-3 pt-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[18px] bg-forest px-6 py-12 text-center text-white sm:py-16">
        <Terraces />
        <Terraces flip />
        <div className="relative">
          <h2 id="final-h" className="font-display text-3xl font-extrabold sm:text-5xl" lang={lang}>{l.finalTitle}</h2>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/85">{l.finalLead}</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn !min-h-12 rounded-full bg-leaf px-6 text-base font-bold text-forest hover:brightness-105">{l.join} <ArrowRight size={18} aria-hidden /></Link>
            <Link href="/login" className="btn !min-h-12 rounded-full border-2 border-white/70 px-6 text-base font-bold text-white hover:bg-white/10">{l.signIn}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ top categories (link list) */
export function TopCategories({ t, lang }: P) {
  const l = t.home.landing;
  return (
    <section aria-labelledby="topcat-h" className="mx-auto max-w-[88rem] scroll-mt-20 px-4 pb-6 pt-20 sm:px-6">
      <h2 id="topcat-h" className="scroll-mt-24 font-display text-2xl font-extrabold sm:text-3xl">{l.topCats}</h2>
      <p className="mt-1 text-muted">{l.topCatsLead}</p>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.filter((c) => c.id !== "other").map((c) => (
          <li key={c.id}><Link href={`/explore?category=${c.id}`} className="font-semibold text-text hover:text-accent hover:underline">{lang === "ne" ? c.ne : c.en}</Link></li>
        ))}
      </ul>
    </section>
  );
}
