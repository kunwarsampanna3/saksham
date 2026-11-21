import Link from "next/link";
import { Logo } from "@/components/logo";
import { Contours } from "@/components/contours";
import { getDict } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getDict();
  const s = t.status;
  return (
    <main id="main" className="relative min-h-dvh overflow-hidden">
      <Contours seed={9} centers={2} rings={10} />
      <div className="relative mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <Logo />
        <p className="font-display text-accent mt-16 text-7xl font-extrabold" aria-hidden>
          404
        </p>
        <h1 className="font-display mt-2 text-4xl font-extrabold">{s.notFound}</h1>
        <p className="text-muted mt-3 text-lg">{s.notFoundLead}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            {s.home}
          </Link>
          <Link href="/explore" className="btn btn-ghost">
            {s.explore}
          </Link>
        </div>
      </div>
    </main>
  );
}
