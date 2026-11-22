import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Contours } from "@/components/contours";
import { Logo } from "@/components/logo";
import { LangSwitch, ThemeToggle } from "@/components/prefs-controls";
import { photo } from "@/lib/photos";
import { getDict } from "@/lib/i18n/server";

/**
 * Split-screen auth layout.
 *  Desktop (lg+): photo panel left (5/12), card right.
 *  Mobile: photo header on top, card slides up over it.
 */
export async function AuthShell({ children, below }: { children: ReactNode; below?: ReactNode }) {
  const { t, lang } = await getDict();
  const p = photo("login");

  const Visual = ({ variant }: { variant: "panel" | "header" }) => (
    <div className="bg-forest absolute inset-0 overflow-hidden">
      {p ? (
        <>
          <Image
            src={p.src}
            alt={p.alt[lang]}
            fill
            priority
            sizes={variant === "panel" ? "(min-width: 1024px) 42vw, 0px" : "100vw"}
            className="object-cover"
          />
          <div
            className="from-forest/90 via-forest/30 to-forest/10 absolute inset-0 bg-gradient-to-t"
            aria-hidden
          />
        </>
      ) : (
        <TerraceArt />
      )}
      {p?.isSample && (
        <span className="demo-tag absolute top-3 right-3 z-10 !border-white/40 !bg-black/55 !text-white">
          {t.common.samplePhoto}
        </span>
      )}
    </div>
  );

  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-12">
      <a href="#auth-main" className="skip-link">
        {t.nav.skip}
      </a>

      {/* Desktop photo panel */}
      <aside className="relative hidden lg:col-span-5 lg:block xl:col-span-5" aria-label={t.brand.tagline}>
        <div className="sticky top-0 h-dvh">
          <Visual variant="panel" />
          <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
            <Logo onDark />
            <div className={p ? "" : "mb-48"}>
              <p lang="ne" className="deva text-leaf text-lg font-semibold">
                तपाईंको सीप। तपाईंको मूल्य।
              </p>
              <p className="font-display mt-1 max-w-md text-4xl leading-[1.05] font-bold xl:text-5xl">
                {t.login.photoCaption}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile photo header */}
      <div className="relative h-56 lg:hidden">
        <Visual variant="header" />
        <div className="relative z-10 flex items-start justify-between p-4">
          <Logo onDark />
          <div className="flex items-center gap-2">
            <LangSwitch tone="onDark" />
          </div>
        </div>
      </div>

      <main id="auth-main" className="relative lg:col-span-7 lg:flex lg:min-h-dvh lg:flex-col">
        <div className="hidden items-center justify-end gap-2 p-6 lg:flex">
          <Link href="/" className="btn btn-quiet mr-auto">
            <ArrowLeft size={16} aria-hidden /> {t.home.landing.back}
          </Link>
          <LangSwitch />
          <ThemeToggle />
        </div>
        <div className="relative -mt-10 px-4 pb-10 sm:px-8 lg:mt-0 lg:flex lg:flex-1 lg:items-start lg:justify-center lg:pt-[6vh]">
          <div className="sheet-in relative mx-auto w-full max-w-[30rem] lg:animate-none">
            <div className="notch-frame">
              <div className="notch-card terrace-edge relative overflow-hidden px-5 pt-7 pb-8 sm:px-8 sm:pt-9">
                <Contours seed={21} centers={1} rings={6} className="opacity-70" />
                <div className="relative">{children}</div>
              </div>
            </div>
            {below}
            <div className="mt-6 flex items-center justify-center gap-3 lg:hidden">
              <Link href="/" className="btn btn-quiet">
                <ArrowLeft size={16} aria-hidden /> {t.home.landing.back}
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Fallback visual when no licensed photo is present: terraces + a cropped giant Devanagari word. */
function TerraceArt() {
  return (
    <div className="absolute inset-0" aria-hidden>
      <div className="absolute inset-0 [--contour:rgba(108,195,106,.16)]">
        <Contours seed={3} centers={2} rings={11} />
      </div>
      <span className="deva-giant absolute -bottom-[0.18em] -left-[0.06em] text-[11rem] [-webkit-text-stroke-color:rgba(108,195,106,.35)] lg:text-[16rem]">
        सक्षम
      </span>
      <div className="absolute right-0 bottom-0 flex w-2/3 flex-col items-end">
        {[38, 54, 70, 86, 100].map((w, i) => (
          <div
            key={w}
            className="rise h-5 lg:h-8"
            style={{
              width: `${w}%`,
              background: i % 2 ? "var(--paddy)" : "var(--leaf)",
              opacity: 0.25 + i * 0.12,
              ["--delay" as string]: `${0.15 * i}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
