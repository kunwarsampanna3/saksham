import type { Metadata } from "next";
import { LandingHero, PostFirstTask, FinalCta, TrustSafety, TwoPaths } from "@/components/home/landing";
import { Abroad } from "@/components/home/sections";
import { Dashboard } from "@/components/home/dashboard";
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
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({ searchParams }: { searchParams: SP }) {
  const [user, { t, lang }] = await Promise.all([currentUser(), getDict()]);

  if (!user) {
    return (
      <>
        <LandingHero t={t} lang={lang} visitor />
        <TwoPaths t={t} lang={lang} />
        <PostFirstTask t={t} lang={lang} visitor />
        <Showcase visitor />
        <TrustSafety t={t} lang={lang} />
        <Abroad t={t} lang={lang} />
        <FinalCta t={t} lang={lang} />
      </>
    );
  }

  // Signed in: a simple eSewa-style home with separate cards; the full list + map lives on Browse tasks.
  void searchParams;
  return <Dashboard t={t} lang={lang} user={user} city={await getCity(user.city)} />;
}
