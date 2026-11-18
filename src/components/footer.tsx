import Link from "next/link";
import { Info } from "lucide-react";
import { Logo } from "./logo";
import { Contours } from "./contours";
import { getDict } from "@/lib/i18n/server";

export async function Footer() {
  const { t } = await getDict();
  const f = t.footer;
  const cols = [
    { title: f.product, links: [["/#how", f.howItWorks], ["/safety#guarantee", f.guarantee], ["/wallet#fees", f.fees], ["/abroad", t.nav.abroad]] },
    { title: f.forProviders, links: [["/verification", t.nav.verification], ["/wallet#passport", f.passport], ["/wallet#credit", f.credit], ["/explore", t.nav.explore]] },
    { title: f.help, links: [["/safety", f.safety], ["/safety#report", f.report], ["/contact", f.contact]] },
    { title: f.legal, links: [["/terms", f.terms], ["/privacy", f.privacy], ["/credits", f.credits]] },
  ] as const;

  return (
    <footer className="relative mt-24 overflow-hidden bg-forest text-[#d9e8dd] [--contour:rgba(108,195,106,.12)]">
      <Contours seed={42} centers={2} rings={8} />
      <span lang="ne" aria-hidden className="deva-giant absolute -bottom-[0.22em] right-[-0.05em] text-[9rem] [-webkit-text-stroke-color:rgba(108,195,106,.22)] sm:text-[14rem]">सीप</span>
      <div className="relative mx-auto max-w-[88rem] px-4 pb-10 pt-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo onDark />
            <p className="mt-4 max-w-sm text-[0.98rem] leading-relaxed">{f.about}</p>
            <p className="font-display mt-4 text-lg font-bold text-white">{t.brand.tagline}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {cols.map((c) => (
              <nav key={c.title} aria-label={c.title}>
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-leaf">{c.title}</h2>
                <ul className="mt-3 space-y-2">
                  {c.links.map(([href, label]) => (
                    <li key={href}><Link href={href} className="text-[0.95rem] hover:text-white hover:underline hover:underline-offset-4">{label}</Link></li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <p className="mt-12 flex max-w-3xl items-start gap-2 border-t border-white/15 pt-6 text-sm text-[#b7cdbd]">
          <Info size={16} aria-hidden className="mt-0.5 shrink-0" /> {f.honesty}
        </p>
        <p className="mt-3 text-sm text-[#b7cdbd]">© {new Date().getFullYear()} Saksham · {f.rights}</p>
      </div>
    </footer>
  );
}
