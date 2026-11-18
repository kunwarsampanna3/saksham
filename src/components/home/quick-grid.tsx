import Link from "next/link";
import {
  ChevronRight, ClipboardList, Globe2, LifeBuoy, MessageSquare, Plus, ShieldAlert, ShieldCheck, Wallet, type LucideIcon,
} from "lucide-react";
import { CATEGORY_ICONS } from "@/components/browse/cards";
import type { CategoryId } from "@/lib/pricing";
import type { Dict, Lang } from "@/lib/i18n/dict";

export const IT: CategoryId[] = ["web-design", "coding", "it-support", "phone-repair", "digital-marketing", "tutoring", "translation"];
export const HOME: CategoryId[] = ["tailoring", "electrician", "plumbing", "cleaning", "moving", "photography", "beauty"];

interface Tile { href: string; label: string; Icon: LucideIcon; accent?: boolean; badge?: number; active?: boolean }

/** One grouped card: a title and a 4-column grid of icon tiles, the last tile optionally a "see all" arrow. */
export function Group({ id, title, tiles, all, wide = false }: { id: string; title: string; tiles: Tile[]; all?: { href: string; label: string }; wide?: boolean }) {
  return (
    <section aria-labelledby={id} className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
      <h2 id={id} className="font-display text-lg font-bold sm:text-xl">{title}</h2>
      <ul className={`mt-3 grid grid-cols-4 gap-x-1 gap-y-3 sm:gap-y-4 ${wide ? "md:grid-cols-8" : ""}`}>
        {tiles.map(({ href, label, Icon, accent, badge, active }) => (
          <li key={href + label}>
            <Link href={href} scroll={false} aria-current={active ? "true" : undefined} className={`group flex flex-col items-center gap-1.5 rounded-[8px] px-0.5 py-1.5 text-center ${active ? "bg-accent-soft ring-2 ring-accent" : "hover:bg-accent-soft"}`}>
              <span className={`relative inline-flex h-12 w-12 items-center justify-center rounded-[10px] transition-transform group-hover:-translate-y-0.5 motion-reduce:transform-none ${accent || active ? "bg-accent text-accent-contrast" : "bg-accent-soft text-accent"}`}>
                <Icon size={24} strokeWidth={1.8} aria-hidden />
                {!!badge && <span className="absolute -right-1 -top-1 rounded-full bg-clay px-1.5 text-[0.65rem] font-bold leading-4 text-white">{badge > 9 ? "9+" : badge}</span>}
              </span>
              <span className="text-[0.8rem] font-semibold leading-tight sm:text-sm">{label}</span>
            </Link>
          </li>
        ))}
        {all && (
          <li className="flex items-start justify-center pt-1.5">
            <Link href={all.href} aria-label={`${all.label}: ${title}`}
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line-strong text-accent hover:border-accent hover:bg-accent-soft">
              <ChevronRight size={22} aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Home's grouped service cards: IT skills, everyday services, and the user's own shortcuts. */
export function QuickGrid({ t, isProvider, stacked = false }: { t: Dict; lang: Lang; isProvider: boolean; stacked?: boolean }) {
  const q = t.home.quick;
  const cat = (id: CategoryId): Tile => ({ href: `/explore?category=${id}`, label: q.short[id], Icon: CATEGORY_ICONS[id] });
  const mine: Tile[] = [
    { href: "/post", label: q.post, Icon: Plus, accent: true },
    { href: "/my-tasks", label: q.tasks, Icon: ClipboardList },
    { href: "/messages", label: q.messages, Icon: MessageSquare },
    { href: "/wallet", label: q.wallet, Icon: Wallet },
    { href: "/verification", label: q.verify, Icon: ShieldCheck },
    { href: "/abroad", label: q.abroad, Icon: Globe2 },
    { href: "/safety", label: q.safety, Icon: ShieldAlert },
    { href: "/contact", label: q.help, Icon: LifeBuoy },
  ];
  // Providers see their own shortcuts first; clients see what they can hire first.
  const groups = [
    <Group key="it" id="q-it" title={q.it} tiles={IT.map(cat)} all={{ href: "/explore", label: q.all }} wide={stacked} />,
    <Group key="home" id="q-home" title={q.home} tiles={HOME.map(cat)} all={{ href: "/explore", label: q.all }} wide={stacked} />,
    <Group key="mine" id="q-mine" title={q.mine} tiles={mine} wide={stacked} />,
  ];
  return (
    <div className={stacked ? "grid gap-4" : "mx-auto grid max-w-[88rem] gap-3 px-3 pt-6 sm:gap-4 sm:px-6 lg:grid-cols-3"}>
      {stacked ? [groups[2], groups[0], groups[1]] : isProvider ? [groups[2], groups[0], groups[1]] : groups}
    </div>
  );
}

