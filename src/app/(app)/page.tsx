import { LandingHero, FirstTask, TopCategories } from "@/components/home/landing";
import { LiveTasks, TrustBand, Abroad, ProviderCta, ItStudents } from "@/components/home/sections";
import { requireUser } from "@/lib/auth/current-user";
import { getCity, getDict } from "@/lib/i18n/server";

/**
 * Home, in the classic marketplace order: big hero with the two main actions →
 * "post your first task" (steps + task box + category cards) → live tasks → trust →
 * IT students → hire from abroad → become a provider → category link list.
 */
export default async function Home() {
  const [user, { t, lang }] = await Promise.all([requireUser("/"), getDict()]);
  const city = await getCity(user.city);
  const isProvider = user.roles.includes("provider");

  return (
    <>
      <LandingHero t={t} lang={lang} name={user.name} isProvider={isProvider} />
      <FirstTask t={t} lang={lang} />
      <LiveTasks t={t} lang={lang} city={city} viewer={user} />
      <TrustBand t={t} lang={lang} />
      <ItStudents t={t} lang={lang} isProvider={isProvider} />
      <Abroad t={t} lang={lang} />
      <ProviderCta t={t} lang={lang} isProvider={isProvider} />
      <TopCategories t={t} lang={lang} />
    </>
  );
}
