import type { Metadata } from "next";
import { Contours } from "@/components/contours";
import { PostWizard } from "@/components/post/wizard";
import { QuickBid } from "@/components/post/quick-bid";
import { PostTabs } from "@/components/post/post-tabs";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { priceOverrides } from "@/lib/prices";
import { CATEGORY_IDS } from "@/lib/pricing";
import { EXAMPLE_PROVIDERS } from "@/lib/seed/providers";
import { realProviders } from "@/lib/real-providers";

export const metadata: Metadata = { title: "Post a task" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PostPage({ searchParams }: { searchParams: SP }) {
  const [user, { t }, overrides, sp] = await Promise.all([
    requireUser("/post"),
    getDict(),
    priceOverrides(),
    searchParams,
  ]);
  const pool = user.isDemo ? EXAMPLE_PROVIDERS : await realProviders();
  const counts = Object.fromEntries(
    CATEGORY_IDS.map((c) => [c, pool.filter((p) => p.categories.includes(c as never)).length]),
  );
  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={14} centers={1} rings={9} />
        <span
          lang="ne"
          aria-hidden
          className="deva-giant absolute top-2 -right-4 text-[7rem] sm:text-[11rem]"
        >
          काम
        </span>
        <div className="relative mx-auto max-w-[88rem] px-4 pt-10 pb-8 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t.post.title}</h1>
          <p className="text-muted mt-2 max-w-2xl text-lg">{t.post.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6">
        <PostTabs
          initial={sp.mode === "full" ? "full" : "quick"}
          quick={<QuickBid homeCity={user.city} homeArea={user.area} counts={counts} overrides={overrides} />}
          full={<PostWizard homeCity={user.city} homeArea={user.area} overrides={overrides} />}
        />
      </div>
    </div>
  );
}
