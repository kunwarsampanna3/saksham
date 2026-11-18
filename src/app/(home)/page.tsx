import type { Metadata } from "next";
import { LandingHero, PostFirstTask, TopCategories, FinalCta } from "@/components/home/landing";
import { LiveTasks, Abroad, ProviderCta, HowItWorks } from "@/components/home/sections";
import { Showcase } from "@/components/home/showcase";
import { currentUser } from "@/lib/auth/current-user";
import { getCity, getDict } from "@/lib/i18n/server";

export const metadata: Metadata = {
  description: "Saksham — post any task in Nepal, compare fair offers from verified people, and pay safely in installments. Open to every skill.",
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
        <PostFirstTask t={t} lang={lang} visitor />
        <Showcase visitor />
        <HowItWorks t={t} lang={lang} />
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
      <PostFirstTask t={t} lang={lang} />
      <Showcase />
      <LiveTasks t={t} lang={lang} city={city} viewer={user} />
      <Abroad t={t} lang={lang} />
      <ProviderCta t={t} lang={lang} isProvider={isProvider} />
      <TopCategories t={t} lang={lang} />
    </>
  );
}
