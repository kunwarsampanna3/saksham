import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { DemoPanel } from "@/components/auth/demo-panel";
import { config } from "@/lib/config";
import { DEMO_MPIN } from "@/lib/auth/demo";
import { currentUser } from "@/lib/auth/current-user";
import { safeNext } from "@/lib/safe-next";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(safeNext(next));
  if (config.publicDemo) {
    const { t } = await getDict();
    return (
      <AuthShell>
        <h1 className="font-display text-3xl font-extrabold">{t.market.publicDemo.title}</h1>
        <p className="text-muted mt-2">{t.market.publicDemo.lead}</p>
        <DemoPanel mpin={DEMO_MPIN} next={next} />
      </AuthShell>
    );
  }
  return (
    <AuthShell below={config.demoMode ? <DemoPanel mpin={DEMO_MPIN} next={next} /> : null}>
      <LoginForm next={next} />
    </AuthShell>
  );
}
