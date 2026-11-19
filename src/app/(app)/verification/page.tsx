import type { Metadata } from "next";
import { Contours } from "@/components/contours";
import { VerificationCenter } from "@/components/verify/center";
import { ProfileProgress } from "@/components/verify/profile-progress";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { statusFor } from "@/lib/verification";
import { config } from "@/lib/config";
import { kycRole } from "@/lib/roles";

export const metadata: Metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const [user, { t, lang }] = await Promise.all([requireUser("/verification"), getDict()]);
  const status = await statusFor(user);
  const v = t.verify;
  const role = kycRole(user.roles);
  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={88} centers={1} rings={9} />
        <span lang="ne" aria-hidden className="deva-giant absolute -right-4 top-2 text-[7rem] sm:text-[11rem]">विश्वास</span>
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{v.kycTitle[role]}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{v.kycLead[role]}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <ProfileProgress user={user} status={status} t={t} lang={lang} />
        <VerificationCenter
          initial={status}
          demoMode={config.demoMode}
          role={role}
          city={user.city}
          area={user.area}
        />
      </div>
    </div>
  );
}
