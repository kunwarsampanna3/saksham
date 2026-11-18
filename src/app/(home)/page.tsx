import type { Metadata } from "next";
import { LandingHero, FirstTask, TopCategories, AllCategories, FinalCta } from "@/components/home/landing";
import { LiveTasks, TrustBand, Abroad, ProviderCta, ItStudents, HowItWorks } from "@/components/home/sections";
import { currentUser } from "@/lib/auth/current-user";
import { getCity, getDict } from "@/lib/i18n/server";

export const metadata: Metadata = {
  description: "Saksham — post any task in Nepal, compare fair offers from verified people, and pay safely in installments. Built for IT students, open to every skill.",
};

/**
 * Home, in the classic marketplace order. Visitors (signed out) see the public front page with
 * Join / Sign in; signed-in users see the same style with their task box, live tasks and shortcuts.
 */
export default async function Home() {
  const [user, { t, lang }] = await Promise.all([currentUser(), getDict()]);

  if (!user) {
    return (
      <>
        <LandingHero t={t} lang={lang} visitor />
        <AllCategories t={t} lang={lang} />
        <HowItWorks t={t} lang={lang} />
        <TrustBand t={t} lang={lang} />
        <ItStudents t={t} lang={lang} isProvider={false} visitor />
        <Abroad t={t} lang={lang} />
        <FinalCta t={t} lang={lang} />
        <TopCategories t={t} lang={lang} />
      </>
    );
  }

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
