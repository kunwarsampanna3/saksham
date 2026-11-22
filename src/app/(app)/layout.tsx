import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Assistant } from "@/components/assistant";
import { requireUser } from "@/lib/auth/current-user";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser(); // middleware already checks the cookie; this also checks the account exists
  return (
    <>
      <Header />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <Footer />
      <Assistant />
    </>
  );
}
