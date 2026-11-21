import Link from "next/link";
import { Info } from "lucide-react";
import type { Pin } from "@/components/map/map";
import { MapPanel } from "./map-panel";
import type { Dict } from "@/lib/i18n/dict";

/** List + sticky map layout shared by Explore and Professionals. The list is the primary, accessible view. */
export function ResultsLayout({
  t,
  count,
  pins,
  children,
  note,
  emptyHref,
  split = false,
}: {
  t: Dict;
  count: string;
  pins: Pin[];
  children: React.ReactNode;
  note?: string;
  emptyHref: string;
  split?: boolean;
}) {
  const e = t.explore;
  const empty = !pins.length && !children;
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-12">
      <div className={split ? "lg:col-span-5" : "lg:col-span-7 xl:col-span-8"}>
        <p className="text-muted mb-3 text-sm font-semibold" role="status" aria-live="polite">
          {count}
        </p>
        {empty ? (
          <div className="border-line-strong rounded-[4px] border border-dashed p-8 text-center">
            <p className="font-display text-xl font-bold">{e.empty}</p>
            <p className="text-muted mt-1">{e.emptyHint}</p>
            <Link href={emptyHref} className="btn btn-ghost mt-4">
              {e.clear}
            </Link>
          </div>
        ) : (
          children
        )}
        {note && (
          <p className="text-muted mt-4 flex items-start gap-2 text-sm">
            <Info size={15} aria-hidden className="mt-0.5 shrink-0" /> {note}
          </p>
        )}
      </div>
      <aside
        className={`order-first lg:order-none ${split ? "lg:col-span-7" : "lg:col-span-5 xl:col-span-4"}`}
        aria-label={e.map}
      >
        <MapPanel pins={pins} />
      </aside>
    </div>
  );
}
