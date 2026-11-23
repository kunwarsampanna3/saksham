import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Assistant } from "@/components/assistant";
import { requireUser } from "@/lib/auth/current-user";
import { PausedScreen } from "@/components/paused-screen";
import { siteBlock } from "@/lib/controls";
import { visitorKey } from "@/lib/visitor";
import { config } from "@/lib/config";
import { getDict } from "@/lib/i18n/server";
import { PublicDemoNote } from "@/components/public-demo-note";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // middleware already checks the cookie; this also checks the account exists
  const block = await siteBlock(user, await visitorKey(user.id));
  if (block) return <PausedScreen reason={block} signedIn />;
  return (
    <>
      <span data-app-frame hidden />
      {config.publicDemo && <PublicDemoNote t={(await getDict()).t} />}
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
      <Assistant />
    </>
  );
}
