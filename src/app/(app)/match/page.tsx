import type { Metadata } from "next";
import { Contours } from "@/components/contours";
import { MatchView } from "@/components/match/match-view";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { config } from "@/lib/config";
import { CITY_COORDS } from "@/lib/geo";

export const metadata: Metadata = { title: "AI match & coach" };
export const dynamic = "force-dynamic";

export default async function MatchPage({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const [user, { t }, sp] = await Promise.all([requireUser("/match"), getDict(), searchParams]);
  const working = user.activeRole === "provider" && user.roles.includes("provider");
  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={63} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pt-10 pb-8 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t.match.title}</h1>
          <p className="text-muted mt-2 max-w-2xl text-lg">{t.match.lead}</p>
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6">
        <MatchView
          initial={sp.for === "coach" || (working && sp.for !== "match") ? "coach" : "match"}
          connected={config.hasAnthropic}
          homeCity={Object.hasOwn(CITY_COORDS, user.city) ? user.city : ""}
          cities={Object.keys(CITY_COORDS)}
        />
      </div>
    </div>
  );
}
