import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupFlow } from "@/components/auth/signup-flow";
import { NEPAL_CITIES } from "@/lib/validation";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <AuthShell>
      <SignupFlow cities={NEPAL_CITIES} />
    </AuthShell>
  );
}
