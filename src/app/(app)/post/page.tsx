import type { Metadata } from "next";
import { Contours } from "@/components/contours";
import { PostWizard } from "@/components/post/wizard";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { priceOverrides } from "@/lib/prices";

export const metadata: Metadata = { title: "Post a task" };

export default async function PostPage() {
  const [user, { t }, overrides] = await Promise.all([requireUser("/post"), getDict(), priceOverrides()]);
  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={14} centers={1} rings={9} />
        <span lang="ne" aria-hidden className="deva-giant absolute -right-4 top-2 text-[7rem] sm:text-[11rem]">काम</span>
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t.post.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{t.post.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <PostWizard homeCity={user.city} homeArea={user.area} overrides={overrides} />
      </div>
    </div>
  );
}
