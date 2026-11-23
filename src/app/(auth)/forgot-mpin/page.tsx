import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotFlow } from "@/components/auth/forgot-flow";

export const metadata: Metadata = { title: "Reset MPIN" };

export default function ForgotPage() {
  return (
    <AuthShell>
      <ForgotFlow />
    </AuthShell>
  );
}
