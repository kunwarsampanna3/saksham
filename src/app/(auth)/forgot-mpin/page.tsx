import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotFlow } from "@/components/auth/forgot-flow";

export const metadata: Metadata = { title: "Reset MPIN" };

export default function ForgotPage() {
  if (config.publicDemo) redirect("/login");
  return (
    <AuthShell>
      <ForgotFlow />
    </AuthShell>
  );
}
