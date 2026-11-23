import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupFlow } from "@/components/auth/signup-flow";
import { NEPAL_CITIES } from "@/lib/validation";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  // An open demo has only the example accounts.
  if (config.publicDemo) redirect("/login");
  return (
    <AuthShell>
      <SignupFlow cities={NEPAL_CITIES} />
    </AuthShell>
  );
}
