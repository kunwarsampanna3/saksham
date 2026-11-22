import Link from "next/link";
import {
  ArrowRight,
  Scissors,
  GraduationCap,
  Smartphone,
  Code2,
  PlugZap,
  Droplets,
  Sparkles,
  Truck,
  Camera,
  Languages,
  Brush,
  HeartHandshake,
  Terminal,
  Monitor,
  Megaphone,
  MapPin,
  Plane,
  Landmark,
  BadgeCheck,
  ShieldCheck,
  CalendarClock,
  LockKeyhole,
  Info,
  Calculator,
  ClipboardList,
  Refrigerator,
  Armchair,
  Bike,
  Car,
  Hammer,
  ChefHat,
  HardHat,
  CarFront,
  PartyPopper,
  Sprout,
  Palette,
  Wrench,
  Sofa,
  Shirt,
  Music,
  PaintRoller,
  Bug,
  PawPrint,
  Clapperboard,
  Flame,
  Cctv,
  Sun,
  Grid3x3,
  Umbrella,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Photo } from "@/components/photo";
import { Contours } from "@/components/contours";
import { CATEGORIES, fairRange, type CategoryId } from "@/lib/pricing";
import { creditOffer } from "@/lib/rules";
import { parseFilters } from "@/lib/search";
import { searchTasks } from "@/lib/task-search";
import { ANYWHERE } from "@/lib/geo";
import type { User } from "@/lib/store/types";
import { TaskCard } from "@/components/browse/cards";
import { num, rs, approxUsd, EXAMPLE_USD_RATE } from "@/lib/format";
import { toDeva, type Dict, type Lang } from "@/lib/i18n/dict";
import type { PhotoKey } from "@/lib/photos";
import { ProviderButton } from "./provider-button";

type P = { t: Dict; lang: Lang };

const ICONS: Record<CategoryId, LucideIcon> = {
  tailoring: Scissors,
  tutoring: GraduationCap,
  "phone-repair": Smartphone,
  "web-design": Code2,
  electrician: PlugZap,
  plumbing: Droplets,
  cleaning: Sparkles,
  moving: Truck,
  photography: Camera,
  translation: Languages,
  beauty: Brush,
  "elder-care": HeartHandshake,
  other: Sparkles,
  coding: Terminal,
  "it-support": Monitor,
  "digital-marketing": Megaphone,
  accounting: Calculator,
  admin: ClipboardList,
  appliances: Refrigerator,
  assembly: Armchair,
  "bike-repair": Bike,
  "car-care": Car,
  carpentry: Hammer,
  catering: ChefHat,
  construction: HardHat,
  driving: CarFront,
  events: PartyPopper,
  gardening: Sprout,
  "graphic-design": Palette,
  hair: Scissors,
  handyman: Wrench,
  interior: Sofa,
  laundry: Shirt,
  lessons: Music,
  painting: PaintRoller,
  "pest-control": Bug,
  "pet-care": PawPrint,
  "video-editing": Clapperboard,
  welding: Flame,
  cctv: Cctv,
  solar: Sun,
  tiling: Grid3x3,
  roofing: Umbrella,
};
const CATEGORY_PHOTO: Partial<Record<CategoryId, PhotoKey>> = { tailoring: "tailoring", beauty: "beauty" }; // the computer-lab photo is used by the IT students band

function SectionHead({
  eyebrow,
  title,
  lead,
  id,
  deva,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  id: string;
  deva?: string;
}) {
  return (
    <div className="relative max-w-2xl">
      {deva && (
        <span
          lang="ne"
          aria-hidden
          className="deva-giant absolute -top-14 -left-2 text-[6rem] opacity-60 sm:-top-20 sm:text-[9rem]"
        >
          {deva}
        </span>
      )}
      {eyebrow && <p className="text-accent relative font-semibold">{eyebrow}</p>}
      <h2 id={id} className="font-display relative mt-1 text-[2rem] font-extrabold sm:text-[2.6rem]">
        {title}
      </h2>
      {lead && <p className="text-muted relative mt-2 text-lg">{lead}</p>}
    </div>
  );
}

/* ================================================================ categories */
export function CategoryGrid({ t, lang }: P) {
  const c = t.home.categories;
  const cats = CATEGORIES.filter((x) => x.id !== "other");
  const withPhoto = cats.filter((x) => CATEGORY_PHOTO[x.id]);
  const rest = cats.filter((x) => !CATEGORY_PHOTO[x.id]);
  return (
    <section aria-labelledby="cat-h" className="mx-auto max-w-[88rem] px-4 pt-24 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHead id="cat-h" title={c.title} lead={c.lead} deva="काम" />
        <Link href="/explore" className="btn btn-quiet">
          {c.all} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* IT skills first (category order), then the photo cards */}
        {rest.map((cat) => {
          const Icon = ICONS[cat.id];
          return (
            <li key={cat.id}>
              <Link
                href={`/explore?category=${cat.id}`}
                className="group border-line bg-surface hover:border-accent flex h-full min-h-[8.5rem] flex-col justify-between rounded-[4px] border p-4 transition-[box-shadow,border-color] hover:shadow-[inset_0_-4px_0_0_var(--accent)]"
              >
                <Icon size={26} strokeWidth={1.6} aria-hidden className="text-accent" />
                <span>
                  <span className="block leading-tight font-semibold" lang={lang}>
                    {lang === "ne" ? cat.ne : cat.en}
                  </span>
                  <span className="text-muted block text-sm">
                    {c.from(num(fairRange({ category: cat.id, days: 1 }).low, lang))}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {withPhoto.map((cat) => (
          <li key={cat.id} className="col-span-2 sm:col-span-1 lg:col-span-2">
            <Link href={`/explore?category=${cat.id}`} className="group block h-full">
              <div className="notch-frame h-full">
                <div className={`notch-card terrace-edge relative h-full min-h-[13rem] overflow-hidden`}>
                  <Photo
                    k={CATEGORY_PHOTO[cat.id]!}
                    sizes="(min-width:1024px) 33vw, (min-width:640px) 33vw, 100vw"
                    className="transition-transform duration-500 group-hover:scale-[1.03]"
                    creditAt="top"
                    creditLink={false}
                  />
                  <div
                    className="from-forest via-forest/40 absolute inset-0 bg-gradient-to-t to-transparent"
                    aria-hidden
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="font-display text-xl font-bold" lang={lang}>
                      {lang === "ne" ? cat.ne : cat.en}
                    </p>
                    <p className="text-sm text-white/85">
                      {c.from(num(fairRange({ category: cat.id, days: 1 }).low, lang))}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
        <li>
          <Link
            href="/explore"
            className="bg-forest flex h-full min-h-[8.5rem] flex-col justify-between rounded-[4px] p-4 text-white transition-colors hover:bg-[#145039]"
          >
            <ArrowRight size={26} aria-hidden className="text-leaf" />
            <span className="leading-tight font-semibold">{c.all}</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

/* ================================================================ how it works */
export function HowItWorks({ t, lang }: P) {
  const h = t.home.how;
  return (
    <section
      id="how"
      aria-labelledby="how-h"
      className="bg-surface-2/60 relative mt-28 overflow-hidden py-20"
    >
      <Contours seed={19} centers={2} rings={9} />
      <div className="relative mx-auto max-w-[88rem] px-4 sm:px-6">
        <SectionHead id="how-h" title={h.title} lead={h.lead} />
        <ol className="mt-14 grid gap-3 lg:grid-cols-5 lg:items-end lg:gap-2">
          {h.steps.map(([title, body], i) => (
            <li key={title} className="flex flex-col" style={{ marginLeft: `min(${i}rem, 5vw)` }}>
              <div className="border-line bg-surface relative border p-5 shadow-[inset_0_-4px_0_0_var(--accent)] lg:ml-0 lg:min-h-[19rem]">
                <span
                  className="font-display text-accent/25 text-5xl leading-none font-extrabold"
                  aria-hidden
                >
                  {lang === "ne" ? "१२३४५"[i] : i + 1}
                </span>
                <h3 className="font-display mt-2 text-xl font-bold">
                  <span className="sr-only">{i + 1}. </span>
                  {title}
                </h3>
                <p className="text-muted mt-2 text-[0.97rem]">{body}</p>
              </div>
              {/* the terrace "riser" under each step */}
              <div
                aria-hidden
                className="bg-leaf hidden lg:block"
                style={{ height: `${0.5 + i * 2.5}rem`, opacity: 0.3 + i * 0.14 }}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ================================================================ live tasks */
export async function LiveTasks({ t, lang, city, viewer }: P & { city: string; viewer: User }) {
  const l = t.home.live;
  // Same search as Explore; women-only requests never appear on the public home list.
  const tasks = (
    await searchTasks(parseFilters({}, city, "tasks"), { ...viewer, gender: undefined, womenLed: false })
  )
    .filter((x) => !x.womenOnly)
    .slice(0, 6);
  return (
    <section aria-labelledby="live-h" className="mx-auto max-w-[88rem] px-4 pt-24 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHead
          id="live-h"
          title={city === "Online" ? l.online : city === ANYWHERE ? l.everywhere : l.near(city)}
          lead={l.lead}
        />
        <div className="flex gap-1">
          <Link href="/location" className="btn btn-quiet">
            <MapPin size={16} aria-hidden /> {l.change}
          </Link>
          <Link href="/explore" className="btn btn-quiet">
            {l.all} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
      <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskCard task={task} t={t} lang={lang} />
          </li>
        ))}
      </ul>
      <p className="text-muted mt-4 flex items-center gap-2 text-sm">
        <Info size={15} aria-hidden /> {l.womenNote}
      </p>
    </section>
  );
}

/* ================================================================ trust band */
export function TrustBand({ t }: P) {
  const tr = t.home.trust;
  const icons = [LockKeyhole, BadgeCheck, ShieldCheck, CalendarClock];
  return (
    <section
      aria-labelledby="trust-h"
      className="bg-forest relative mt-28 overflow-hidden py-16 text-[#d9e8dd] [--contour:rgba(108,195,106,.12)]"
    >
      <Contours seed={77} centers={2} rings={7} />
      <div className="relative mx-auto max-w-[88rem] px-4 sm:px-6">
        <h2 id="trust-h" className="font-display text-3xl font-extrabold text-white sm:text-4xl">
          {tr.title}
        </h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {tr.items.map(([title, body], i) => {
            const Icon = icons[i];
            return (
              <li key={title} className="border-leaf/60 border-t-2 pt-5">
                <Icon size={28} strokeWidth={1.6} aria-hidden className="text-leaf" />
                <h3 className="font-display mt-3 text-xl font-bold text-white">{title}</h3>
                <p className="mt-1.5">{body}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-10 inline-flex items-center gap-2 text-sm">
          <span className="demo-tag">Sandbox · demo</span> {tr.note}
        </p>
      </div>
    </section>
  );
}

/* ================================================================ Aasha story */
export function NepalStory({ t }: P) {
  const s = t.home.story;
  const plan = [30, 30, 40];
  return (
    <section
      aria-labelledby="story-h"
      className="mx-auto grid max-w-[88rem] items-center gap-10 px-4 pt-28 sm:px-6 lg:grid-cols-12"
    >
      <div className="lg:col-span-5">
        <div className="notch-frame">
          <div className="notch-card relative aspect-[4/5] overflow-hidden">
            <Photo k="crafts" sizes="(min-width:1024px) 40vw, 100vw" />
          </div>
        </div>
      </div>
      <div className="relative lg:col-span-7">
        <span
          lang="ne"
          aria-hidden
          className="deva-giant absolute -top-16 right-0 text-[7rem] opacity-50 sm:text-[10rem]"
        >
          आशा
        </span>
        <span className="demo-tag relative">{s.tag}</span>
        <h2 id="story-h" className="font-display relative mt-3 text-[2rem] font-extrabold sm:text-[2.6rem]">
          {s.title}
        </h2>
        <div className="text-muted relative mt-5 space-y-4 text-lg">
          {s.body.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
        </div>
        <div
          className="relative mt-6 flex h-10 overflow-hidden rounded-[3px]"
          role="img"
          aria-label="30% / 30% / 40%"
        >
          {plan.map((p, i) => (
            <div
              key={i}
              className="font-display text-forest flex items-center justify-center text-sm font-bold"
              style={{
                width: `${p}%`,
                background: ["var(--leaf)", "var(--paddy)", "var(--mint)"][i],
                color: i === 1 ? "#fff" : undefined,
              }}
            >
              {p}%
            </div>
          ))}
        </div>
        <p className="border-marigold text-muted relative mt-5 border-l-4 pl-3 text-sm">{s.disclaimer}</p>
        <Link href="/wallet#passport" className="btn btn-ghost relative mt-6">
          {s.cta} <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ================================================================ abroad */
const COUNTRIES = ["Qatar", "UAE", "Malaysia", "Australia", "USA", "Japan", "UK"];
export function Abroad({ t, lang }: P) {
  const a = t.home.abroad;
  const r = fairRange({ category: "plumbing", days: 1, city: "Pokhara" });
  return (
    <section aria-labelledby="abroad-h" className="relative mt-28">
      <div className="relative h-[22rem] overflow-hidden sm:h-[26rem]">
        <Photo k="terraces" sizes="100vw" />
        <div
          className="from-forest/90 via-forest/55 absolute inset-0 bg-gradient-to-r to-transparent"
          aria-hidden
        />
        <div className="relative mx-auto flex h-full max-w-[88rem] flex-col justify-center px-4 text-white sm:px-6">
          <p className="text-leaf inline-flex items-center gap-2 font-semibold">
            <Plane size={18} aria-hidden /> {a.eyebrow}
          </p>
          <h2
            id="abroad-h"
            className="font-display mt-2 max-w-2xl text-[2rem] leading-tight font-extrabold sm:text-5xl"
          >
            {a.title}
          </h2>
          <ul className="mt-5 flex max-w-xl flex-wrap gap-2" aria-label="Countries">
            {COUNTRIES.map((c) => (
              <li
                key={c}
                className="rounded-[3px] border border-white/40 px-2.5 py-0.5 text-sm font-semibold"
              >
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mx-auto -mt-12 grid max-w-[88rem] gap-6 px-4 sm:px-6 lg:grid-cols-12">
        <div className="notch-frame relative lg:col-span-5">
          <div className="ticket">
            <div className="px-6 pt-5 pb-4">
              <span className="demo-tag">{a.exampleTag}</span>
              <p className="font-display mt-2 text-lg font-bold">{a.exampleTitle}</p>
            </div>
            <div className="perforation mx-5" aria-hidden />
            <div className="px-6 pt-3 pb-5">
              <p className="font-display text-accent text-2xl font-extrabold">{rs(r.mid, lang)}</p>
              <p className="text-sm font-semibold">{a.approx(String(approxUsd(r.mid)))}</p>
              <p className="text-muted mt-1 text-xs">{a.rateNote(EXAMPLE_USD_RATE)}</p>
            </div>
          </div>
        </div>
        <div className="relative pt-4 lg:col-span-7 lg:pt-16">
          <p className="text-muted text-lg">{a.lead}</p>
          <ol className="mt-5 grid gap-2 sm:grid-cols-2">
            {a.steps.map((s, i) => (
              <li key={s} className="flex items-start gap-3">
                <span className="font-display bg-accent-soft text-accent inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] text-sm font-bold">
                  {lang === "ne" ? "१२३४"[i] : i + 1}
                </span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
          <Link href="/abroad" className="btn btn-primary mt-6">
            {a.cta} <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ provider CTA */
export function ProviderCta({ t, lang, isProvider }: P & { isProvider: boolean }) {
  const p = t.home.provider;
  const sample = { jobs: 12, earnings: 184_000, rating: 4.7 };
  const offer = creditOffer({
    kind: "applicant",
    verifiedEarnings: sample.earnings,
    completedJobs: sample.jobs,
    rating: sample.rating,
  });
  return (
    <section
      aria-labelledby="prov-h"
      className="mx-auto grid max-w-[88rem] items-center gap-10 px-4 pt-28 sm:px-6 lg:grid-cols-12"
    >
      <div className="relative lg:col-span-6">
        <span
          lang="ne"
          aria-hidden
          className="deva-giant absolute -top-16 left-0 text-[7rem] opacity-50 sm:text-[10rem]"
        >
          सीप
        </span>
        <p className="text-accent relative font-semibold">{p.eyebrow}</p>
        <h2
          id="prov-h"
          className="font-display relative mt-1 text-[2.4rem] font-extrabold sm:text-6xl"
          lang={lang}
        >
          {p.title}
        </h2>
        <p className="text-muted relative mt-4 max-w-xl text-lg">{p.lead}</p>
        <p className="relative mt-3 inline-flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck size={16} aria-hidden className="text-accent" /> {p.women}
        </p>
        <div className="relative mt-7">
          {isProvider ? (
            <Link href="/verification" className="btn btn-primary">
              {p.ctaVerify} <ArrowRight size={18} aria-hidden />
            </Link>
          ) : (
            <ProviderButton label={p.ctaStart} />
          )}
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="relative">
          <div className="relative hidden h-56 overflow-hidden sm:block" aria-hidden={false}>
            <Photo k="shop" sizes="(min-width:1024px) 45vw, 100vw" creditAt="top" />
          </div>
          <div className="notch-frame relative z-20 sm:-mt-24 sm:ml-10">
            <div className="notch-card terrace-edge p-6">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-xl font-bold">{p.passport}</p>
                <span className="demo-tag">{p.sample}</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <dt className="text-muted text-xs">{p.jobs}</dt>
                  <dd className="font-display text-2xl font-extrabold">{num(sample.jobs, lang)}</dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">{p.earnings}</dt>
                  <dd className="font-display text-2xl font-extrabold">{rs(sample.earnings, lang)}</dd>
                </div>
                <div>
                  <dt className="text-muted text-xs">{p.rating}</dt>
                  <dd className="font-display text-2xl font-extrabold">
                    <span className="text-marigold" aria-hidden>
                      ★
                    </span>{" "}
                    {lang === "ne" ? toDeva(sample.rating.toFixed(1)) : sample.rating.toFixed(1)}
                  </dd>
                </div>
              </dl>
              <div className="bg-forest mt-5 flex items-center justify-between gap-3 rounded-[4px] p-4 text-white">
                <div>
                  <p className="text-leaf text-xs tracking-wider uppercase">{p.credit}</p>
                  <p className="font-display text-2xl font-extrabold">{rs(offer.limit, lang)}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  <Landmark size={15} aria-hidden /> {p.partner}
                </span>
              </div>
              <p className="text-muted mt-3 text-xs">{p.formula}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ IT students */
export function ItStudents({
  t,
  lang,
  isProvider,
  visitor = false,
}: P & { isProvider: boolean; visitor?: boolean }) {
  const it = t.home.it;
  return (
    <section aria-labelledby="it-h" className="mx-auto max-w-[88rem] px-4 pt-20 sm:px-6">
      <div className="notch-frame">
        <div className="notch-card terrace-edge grid overflow-hidden lg:grid-cols-12">
          <div className="relative min-h-56 lg:col-span-5">
            <Photo k="itPro" sizes="(min-width:1024px) 40vw, 100vw" creditAt="top" />
          </div>
          <div className="p-6 sm:p-8 lg:col-span-7">
            <p className="text-accent font-semibold">{it.eyebrow}</p>
            <h2
              id="it-h"
              className="font-display mt-1 text-[2rem] leading-tight font-extrabold sm:text-5xl"
              lang={lang}
            >
              {it.title}
            </h2>
            <p className="text-muted mt-3 max-w-2xl text-lg">{it.lead}</p>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {it.points.map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <BadgeCheck size={18} aria-hidden className="text-accent mt-0.5 shrink-0" /> {x}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              {visitor ? (
                <Link href="/signup" className="btn btn-primary">
                  {it.cta} <ArrowRight size={18} aria-hidden />
                </Link>
              ) : isProvider ? (
                <Link href="/verification" className="btn btn-primary">
                  {it.cta} <ArrowRight size={18} aria-hidden />
                </Link>
              ) : (
                <ProviderButton label={it.cta} />
              )}
              {!visitor && (
                <Link href="/explore?category=coding" className="btn btn-ghost">
                  {it.browse}
                </Link>
              )}
            </div>
            <p className="text-muted mt-4 text-sm">{it.others}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
