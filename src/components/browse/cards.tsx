import Link from "next/link";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { MapPin, Clock, Users, Globe2, Plane, Star, MessageCircle, BadgeCheck } from "lucide-react";
import { Photo } from "@/components/photo";
import { category } from "@/lib/pricing";
import { rs, rsRange } from "@/lib/format";
import { toDeva, type Dict, type Lang } from "@/lib/i18n/dict";
import type { TaskResult, ProviderResult } from "@/lib/search";

export { CATEGORY_ICONS };

export function VerifiedStamp({ label }: { label: string }) {
  return (
    <span className="stamp">
      <BadgeCheck size={13} aria-hidden /> {label}
    </span>
  );
}

export function WomenLedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#fbe9e3] px-2 py-0.5 text-xs font-bold text-[#8a3a1d] dark:bg-[#3a1d12] dark:text-[#f0b49c]">
      <Users size={12} aria-hidden /> {label}
    </span>
  );
}

export function Stars({ rating, count, t, lang }: { rating: number; count: number; t: Dict; lang: Lang }) {
  if (!count) return <span className="text-muted text-sm font-semibold">{t.browse.new}</span>;
  const r = rating.toFixed(1);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star size={15} aria-hidden className="fill-marigold text-marigold" />
      <strong>{lang === "ne" ? toDeva(r) : r}</strong>
      <span className="text-muted">({t.browse.reviews(count)})</span>
    </span>
  );
}

/* ------------------------------------------------------------------ task */
export function TaskCard({ task, t, lang }: { task: TaskResult; t: Dict; lang: Lang }) {
  const l = t.home.live;
  const cat = category(task.category);
  const Icon = CATEGORY_ICONS[task.category];
  return (
    <div className="notch-frame h-full">
      <Link href={`/task/${task.id}`} className="ticket group flex h-full flex-col">
        <div className="flex-1 px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-accent inline-flex items-center gap-1.5 text-sm font-semibold">
              <Icon size={16} aria-hidden /> {lang === "ne" ? cat.ne : cat.en}
            </span>
            <span className="flex items-center gap-1.5">
              {task.womenOnly && <WomenLedBadge label={t.explore.womenOnly} />}
              {task.isExample && <span className="demo-tag">{t.browse.example}</span>}
            </span>
          </div>
          <h3
            className="font-display group-hover:text-accent mt-2 text-lg leading-snug font-bold"
            lang={lang}
          >
            {task.title[lang]}
          </h3>
          <ul className="text-muted mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            <li className="inline-flex items-center gap-1">
              {task.distanceKm === null && task.city === "Online" ? (
                <Globe2 size={14} aria-hidden />
              ) : (
                <MapPin size={14} aria-hidden />
              )}
              {task.city === "Online"
                ? l.remote
                : `${task.area ? `${task.area}, ` : ""}${task.city}${task.distanceKm !== null ? ` · ${l.km(task.distanceKm.toFixed(1))}` : ""}`}
            </li>
            <li className="inline-flex items-center gap-1">
              <Clock size={14} aria-hidden /> {l.ago(task.postedMinutesAgo)}
            </li>
            {task.forFamilyAbroad && (
              <li className="inline-flex items-center gap-1">
                <Plane size={14} aria-hidden /> {l.fromAbroad(task.forFamilyAbroad)}
              </li>
            )}
          </ul>
        </div>
        <div className="perforation mx-5" aria-hidden />
        <div className="flex items-center justify-between px-6 pt-3 pb-5">
          <span className="font-display text-lg font-extrabold">
            {rsRange(task.range.low, task.range.high, lang)}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold">
            <Users size={15} aria-hidden /> {l.offers(task.offers)}
          </span>
        </div>
      </Link>
    </div>
  );
}

/** Slim list row for the browse view (title + price on top, place and time, status and offers). */
export function TaskRow({ task, t, lang }: { task: TaskResult; t: Dict; lang: Lang }) {
  const l = t.home.live;
  const cat = category(task.category);
  const Icon = CATEGORY_ICONS[task.category];
  return (
    <Link
      href={`/task/${task.id}`}
      className="group border-line bg-surface hover:border-accent hover:bg-accent-soft/40 block rounded-[12px] border p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3
          className="font-display group-hover:text-accent text-[1.08rem] leading-snug font-bold"
          lang={lang}
        >
          {task.title[lang]}
        </h3>
        <span className="font-display shrink-0 text-right text-[1.05rem] leading-tight font-extrabold">
          {rsRange(task.range.low, task.range.high, lang)}
        </span>
      </div>
      <ul className="text-muted mt-2 space-y-1 text-sm">
        <li className="flex items-center gap-1.5">
          {task.city === "Online" ? <Globe2 size={15} aria-hidden /> : <MapPin size={15} aria-hidden />}
          {task.city === "Online"
            ? l.remote
            : `${task.area ? `${task.area}, ` : ""}${task.city}${task.distanceKm !== null ? ` · ${l.km(task.distanceKm.toFixed(1))}` : ""}`}
        </li>
        <li className="flex items-center gap-1.5">
          <Clock size={15} aria-hidden /> {l.ago(task.postedMinutesAgo)}
        </li>
        {task.forFamilyAbroad && (
          <li className="flex items-center gap-1.5">
            <Plane size={15} aria-hidden /> {l.fromAbroad(task.forFamilyAbroad)}
          </li>
        )}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-accent font-bold">{t.home.live.open}</span>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-muted">{l.offers(task.offers)}</span>
          {task.womenOnly && <WomenLedBadge label={t.explore.womenOnly} />}
          {task.isExample && <span className="demo-tag">{t.browse.example}</span>}
        </span>
        <span
          className="bg-accent-soft text-accent grid h-10 w-10 shrink-0 place-items-center rounded-full"
          title={lang === "ne" ? cat.ne : cat.en}
        >
          <Icon size={19} aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/* -------------------------------------------------------------- provider */
export function ProviderCard({ p, t, lang }: { p: ProviderResult; t: Dict; lang: Lang }) {
  const b = t.browse;
  const initials = p.name
    .replace(/[^\p{L} ]/gu, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const cats = p.categories.map((c) => (lang === "ne" ? category(c).ne : category(c).en)).join(" · ");
  return (
    <article className="notch-frame h-full">
      <div className="notch-card terrace-edge relative flex h-full flex-col">
        <div className="relative h-32 overflow-hidden">
          {p.isReal ? (
            <div className="from-forest via-forest to-accent h-full w-full bg-gradient-to-br" aria-hidden />
          ) : (
            <Photo k={p.cover} sizes="(min-width:1280px) 25vw, (min-width:640px) 50vw, 100vw" credit="none" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" aria-hidden />
        </div>
        <div className="flex flex-1 flex-col px-5 pb-5">
          <div className="-mt-7 flex items-end justify-between gap-2">
            <span
              className="font-display border-surface bg-forest relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-[5px] border-[3px] text-lg font-bold text-white"
              aria-hidden
            >
              {initials}
            </span>
            {!p.isReal && <span className="demo-tag mb-1">{b.exampleProfile}</span>}
          </div>
          <h3 className="font-display mt-2 text-lg leading-tight font-bold">
            <Link href={`/profile/${p.id}`} className="hover:text-accent after:absolute after:inset-0">
              {p.name}
            </Link>
          </h3>
          <p className="text-muted text-sm">{p.headline[lang]}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {p.verified && <VerifiedStamp label={b.verified} />}
            {p.womenLed && <WomenLedBadge label={b.womenLed} />}
            <span className="bg-accent-soft text-accent rounded-[3px] px-2 py-0.5 text-xs font-bold">
              {b.level(p.level)}
            </span>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              {p.isReal && p.ratingCount === 0 ? (
                <span className="text-accent inline-flex items-center gap-1.5 font-semibold">
                  <Star size={14} aria-hidden /> {b.newProvider}
                </span>
              ) : (
                <Stars rating={p.rating} count={p.ratingCount} t={t} lang={lang} />
              )}
            </li>
            {!(p.isReal && !p.responseMinutes) && (
              <li className="text-muted inline-flex items-center gap-1.5">
                <MessageCircle size={14} aria-hidden /> {b.replies(p.responseMinutes)}
              </li>
            )}
            <li className="text-muted flex items-center gap-1.5">
              <MapPin size={14} aria-hidden /> {p.area ? `${p.area}, ` : ""}
              {p.city}
              {p.distanceKm !== null && <> · {b.km(p.distanceKm.toFixed(1))}</>}
              {p.onlineOk && (
                <span className="ml-1 inline-flex items-center gap-1">
                  <Globe2 size={13} aria-hidden /> {b.onlineOk}
                </span>
              )}
            </li>
          </ul>
          <p className="text-muted mt-1 text-xs">{cats}</p>
          <div className="mt-auto flex items-end justify-between pt-4">
            <span className="font-display text-lg font-extrabold">
              {rsRange(p.priceMin, p.priceMax, lang)}
            </span>
            <span className="text-muted text-xs">{b.jobs(p.jobsDone)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export { rs };
