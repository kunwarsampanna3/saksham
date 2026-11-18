import type { Metadata } from "next";
import { Contours } from "@/components/contours";
import { SafetyView } from "@/components/safety/safety-view";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { counterparts } from "@/lib/safety";

export const metadata: Metadata = { title: "Safety" };
export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const [user, { t }] = await Promise.all([requireUser("/safety"), getDict()]);
  const [people, blocks] = await Promise.all([counterparts(user), store.listBlocks(user.id)]);
  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={93} centers={1} rings={8} />
        <span lang="ne" aria-hidden className="deva-giant absolute -right-4 top-2 text-[7rem] sm:text-[11rem]">सुरक्षा</span>
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t.safety.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{t.safety.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <SafetyView
          initialContacts={user.trustedContacts ?? []}
          people={people}
          blockedIds={blocks.filter((b) => b.blockerId === user.id).map((b) => b.blockedId)}
        />
      </div>
    </div>
  );
}
