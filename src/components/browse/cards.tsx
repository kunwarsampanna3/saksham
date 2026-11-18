import Link from "next/link";
import { CATEGORY_ICONS } from "@/components/category-icons";
import { MapPin, Clock, Users, Globe2, Plane, Star, MessageCircle, BadgeCheck } from "lucide-react";
import { Photo } from "@/components/photo";
import { category, type CategoryId } from "@/lib/pricing";
import { rs, rsRange } from "@/lib/format";
import { toDeva, type Dict, type Lang } from "@/lib/i18n/dict";
import type { TaskResult, ProviderResult } from "@/lib/search";

export { CATEGORY_ICONS };

export function VerifiedStamp({ label }: { label: string }) {
  return <span className="stamp"><BadgeCheck size={13} aria-hidden /> {label}</span>;
}

export function WomenLedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] bg-[#fbe9e3] px-2 py-0.5 text-xs font-bold text-[#8a3a1d] dark:bg-[#3a1d12] dark:text-[#f0b49c]">
      <Users size={12} aria-hidden /> {label}
    </span>
  );
}

export function Stars({ rating, count, t, lang }: { rating: number; count: number; t: Dict; lang: Lang }) {
  if (!count) return <span className="text-sm font-semibold text-muted">{t.browse.new}</span>;
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
        <div className="flex-1 px-6 pb-4 pt-5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              <Icon size={16} aria-hidden /> {lang === "ne" ? cat.ne : cat.en}
            </span>
            <span className="flex items-center gap-1.5">
              {task.womenOnly && <WomenLedBadge label={t.explore.womenOnly} />}
              {task.isExample && <span className="demo-tag">{t.browse.example}</span>}
            </span>
          </div>
          <h3 className="font-display mt-2 text-lg font-bold leading-snug group-hover:text-accent" lang={lang}>{task.title[lang]}</h3>
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
            <li className="inline-flex items-center gap-1">
              {task.distanceKm === null && task.city === "Online" ? <Globe2 size={14} aria-hidden /> : <MapPin size={14} aria-hidden />}
              {task.city === "Online"
                ? l.remote
                : `${task.area ? `${task.area}, ` : ""}${task.city}${task.distanceKm !== null ? ` · ${l.km(task.distanceKm.toFixed(1))}` : ""}`}
            </li>
            <li className="inline-flex items-center gap-1"><Clock size={14} aria-hidden /> {l.ago(task.postedMinutesAgo)}</li>
            {task.forFamilyAbroad && <li className="inline-flex items-center gap-1"><Plane size={14} aria-hidden /> {l.fromAbroad(task.forFamilyAbroad)}</li>}
          </ul>
        </div>
        <div className="perforation mx-5" aria-hidden />
        <div className="flex items-center justify-between px-6 pb-5 pt-3">
          <span className="font-display text-lg font-extrabold">{rsRange(task.range.low, task.range.high, lang)}</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold"><Users size={15} aria-hidden /> {l.offers(task.offers)}</span>
        </div>
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------- provider */
export function ProviderCard({ p, t, lang }: { p: ProviderResult; t: Dict; lang: Lang }) {
  const b = t.browse;
  const initials = p.name.replace(/[^\p{L} ]/gu, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const cats = p.categories.map((c) => (lang === "ne" ? category(c).ne : category(c).en)).join(" · ");
  return (
    <article className="notch-frame h-full">
      <div className="notch-card terrace-edge relative flex h-full flex-col">
        <div className="relative h-32 overflow-hidden">
          <Photo k={p.cover} sizes="(min-width:1280px) 25vw, (min-width:640px) 50vw, 100vw" credit="none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" aria-hidden />
        </div>
        <div className="flex flex-1 flex-col px-5 pb-5">
          <div className="-mt-7 flex items-end justify-between gap-2">
            <span className="font-display relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-[5px] border-[3px] border-surface bg-forest text-lg font-bold text-white" aria-hidden>
              {initials}
            </span>
            <span className="demo-tag mb-1">{b.exampleProfile}</span>
          </div>
          <h3 className="font-display mt-2 text-lg font-bold leading-tight">
            <Link href={`/profile/${p.id}`} className="after:absolute after:inset-0 hover:text-accent">{p.name}</Link>
          </h3>
          <p className="text-sm text-muted">{p.headline[lang]}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {p.verified && <VerifiedStamp label={b.verified} />}
            {p.womenLed && <WomenLedBadge label={b.womenLed} />}
            <span className="rounded-[3px] bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">{b.level(p.level)}</span>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            <li><Stars rating={p.rating} count={p.ratingCount} t={t} lang={lang} /></li>
            <li className="inline-flex items-center gap-1.5 text-muted"><MessageCircle size={14} aria-hidden /> {b.replies(p.responseMinutes)}</li>
            <li className="flex items-center gap-1.5 text-muted">
              <MapPin size={14} aria-hidden /> {p.area}, {p.city}
              {p.distanceKm !== null && <> · {b.km(p.distanceKm.toFixed(1))}</>}
              {p.onlineOk && <span className="ml-1 inline-flex items-center gap-1"><Globe2 size={13} aria-hidden /> {b.onlineOk}</span>}
            </li>
          </ul>
          <p className="mt-1 text-xs text-muted">{cats}</p>
          <div className="mt-auto flex items-end justify-between pt-4">
            <span className="font-display text-lg font-extrabold">{rsRange(p.priceMin, p.priceMax, lang)}</span>
            <span className="text-xs text-muted">{b.jobs(p.jobsDone)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export { rs };
