import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Assistant } from "@/components/assistant";
import { PublicHeader } from "@/components/home/landing";
import { currentUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";

/** "/" is open to everyone: signed-in users get the app frame, visitors a public one. */
export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const [user, { t }] = await Promise.all([currentUser(), getDict()]);
  return (
    <>
      {user ? <Header /> : <PublicHeader t={t} />}
      <main id="main" tabIndex={-1} className="outline-none">{children}</main>
      <Footer />
      {user && <Assistant />}
    </>
  );
}
