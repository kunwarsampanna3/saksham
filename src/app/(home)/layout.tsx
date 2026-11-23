import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Assistant } from "@/components/assistant";
import { PublicHeader } from "@/components/home/landing";
import { currentUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { PausedScreen } from "@/components/paused-screen";
import { siteBlock } from "@/lib/controls";
import { visitorKey } from "@/lib/visitor";
import { config } from "@/lib/config";
import { PublicDemoNote } from "@/components/public-demo-note";

/** "/" is open to everyone: signed-in users get the app frame, visitors a public one. */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([currentUser(), getDict()]);
  const block = await siteBlock(user, await visitorKey(user?.id));
  if (block) return <PausedScreen reason={block} signedIn={!!user} />;
  return (
    <>
      <span data-app-frame hidden />
      {config.publicDemo && <PublicDemoNote t={t} />}
      {user ? <Header /> : <PublicHeader t={t} />}
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
      {user && <Assistant />}
    </>
  );
}
