import type { Dict } from "@/lib/i18n/dict";

/** Shown on every page of an open demo. */
export function PublicDemoNote({ t }: { t: Dict }) {
  return (
    <p data-public-demo className="bg-marigold px-4 py-1.5 text-center text-sm font-semibold text-[#0d1a14]">
      {t.market.publicDemo.banner}
    </p>
  );
}
