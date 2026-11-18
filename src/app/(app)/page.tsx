import { Contours } from "@/components/contours";
import { Photo } from "@/components/photo";
import { TaskBox } from "@/components/home/task-box";
import { QuickGrid } from "@/components/home/quick-grid";
import { HowItWorks, LiveTasks, TrustBand, NepalStory, Abroad, ProviderCta, ItStudents } from "@/components/home/sections";
import { requireUser } from "@/lib/auth/current-user";
import { getCity, getDict } from "@/lib/i18n/server";

export default async function Home() {
  const [user, { t, lang }] = await Promise.all([requireUser("/"), getDict()]);
  const city = await getCity(user.city);
  const h = t.home.hero;
  const d = (s: number) => ({ ["--delay" as string]: `${s}s` });

  return (
    <>
      {/* ---------------------------------------------------------------- hero
          The one orchestrated moment: contour lines draw in, terraces rise, copy follows. */}
      <section aria-labelledby="hero-h" className="relative overflow-hidden">
        <Contours seed={11} animate centers={2} rings={11} />
        <div className="relative mx-auto grid max-w-[88rem] gap-10 px-4 pb-4 pt-10 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:pt-16">
          <div className="lg:col-span-7">
            <p className="rise text-sm font-semibold text-muted" style={d(0.15)}>{t.home.hello(user.name)}</p>
            <p className="rise mt-1 font-semibold text-accent" style={d(0.25)}>{h.eyebrow}</p>
            <h1 id="hero-h" className="font-display mt-2 text-[3.1rem] font-extrabold leading-[0.98] xs:text-[3.6rem] sm:text-7xl xl:text-[5.4rem]" lang={lang}>
              <span className="rise block" style={d(0.35)}>{h.line1}</span>
              <span className="rise block text-accent" style={d(0.5)}>{h.line2}</span>
            </h1>
            <p className="rise mt-5 max-w-xl text-lg text-muted sm:text-xl" style={d(0.65)}>{h.lead}</p>
            <div className="rise mt-7 max-w-2xl" style={d(0.8)}>
              <TaskBox />
            </div>
          </div>

          <div className="relative lg:col-span-5">
            <span lang="ne" aria-hidden className="deva-giant absolute -right-6 -top-6 z-0 text-[7rem] sm:text-[10rem] lg:-top-10 lg:text-[13rem]">सक्षम</span>
            <div className="rise relative z-10 lg:mt-10" style={d(0.4)}>
              <div className="notch-frame">
                <div className="notch-card relative h-72 overflow-hidden sm:h-96 lg:h-[34rem]">
                  <Photo k="hero" priority sizes="(min-width:1024px) 40vw, 100vw" />
                </div>
              </div>
            </div>
            {/* terraces rising out of the photo's bottom-left corner */}
            <div aria-hidden className="pointer-events-none absolute -bottom-3 -left-4 z-20 flex w-2/3 flex-col items-start sm:-left-8">
              {[34, 52, 70, 88].map((w, i) => (
                <div key={w} className="rise h-3 sm:h-4" style={{ width: `${w}%`, background: i % 2 ? "var(--paddy)" : "var(--leaf)", ...d(1 + i * 0.12) }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <QuickGrid t={t} lang={lang} isProvider={user.roles.includes("provider")} />
      <ItStudents t={t} lang={lang} isProvider={user.roles.includes("provider")} />
      <HowItWorks t={t} lang={lang} />
      <LiveTasks t={t} lang={lang} city={city} viewer={user} />
      <TrustBand t={t} lang={lang} />
      <NepalStory t={t} lang={lang} />
      <Abroad t={t} lang={lang} />
      <ProviderCta t={t} lang={lang} isProvider={user.roles.includes("provider")} />
    </>
  );
}
