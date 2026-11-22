import Link from "next/link";
import { Clock, Plus } from "lucide-react";
import type { PostPayment, Removal } from "@/lib/store/types";
import { postPhase } from "@/lib/business";
import { npDate, rs } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dict";

/** Where a paid post stands: until when for its owner, or that it has ended. */
export function PostNotice({
  post,
  removed,
  owner,
  waiting,
  againHref,
  t,
  lang,
}: {
  post?: PostPayment;
  removed?: Removal;
  owner: boolean;
  /** Nobody is hired yet, so the clock matters */
  waiting: boolean;
  againHref: string;
  t: Dict;
  lang: Lang;
}) {
  const p = t.market.post;
  const phase = waiting ? postPhase(post) : null;
  const when = (iso: string) => npDate(iso, lang, { time: true });
  const text = removed
    ? owner
      ? p.removedOwner(removed.reason)
      : p.removed
    : phase === "expired"
      ? owner
        ? p.expiredOwner
        : p.expired
      : owner && post && phase === "paid"
        ? p.paidUntil(when(post.endsAt))
        : owner && post && phase === "free"
          ? p.freeUntil(when(post.removeAt))
          : null;
  if (!text && !(owner && post)) return null;
  const ended = !!removed || phase === "expired";
  return (
    <div role="status" data-post-phase={removed ? "removed" : (phase ?? "settled")}>
      <div
        className={`rounded-[4px] border-l-4 p-4 ${ended ? "border-danger bg-danger-soft" : "border-accent bg-accent-soft"}`}
      >
        {text && (
          <p className="flex items-start gap-2 font-semibold">
            <Clock size={17} aria-hidden className="mt-1 shrink-0" /> {text}
          </p>
        )}
        {owner && post && (
          <p className="text-muted mt-1 text-sm">{p.receipt(rs(post.fee, lang), post.receiptNo)}</p>
        )}
        {owner && ended && (
          <Link href={againHref} className="btn btn-primary mt-3 !min-h-10">
            <Plus size={16} aria-hidden /> {p.again}
          </Link>
        )}
      </div>
    </div>
  );
}
