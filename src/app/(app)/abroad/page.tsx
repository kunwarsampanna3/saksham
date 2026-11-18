import type { Metadata } from "next";
import { Contours } from "@/components/contours";
import { AbroadPlanner } from "@/components/abroad/planner";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Hire from abroad" };

export default async function AbroadPage() {
  const [user, { t }] = await Promise.all([requireUser("/abroad"), getDict()]);
  const a = t.abroad2;
  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={21} centers={2} rings={9} />
        <span lang="ne" aria-hidden className="deva-giant absolute -right-4 top-2 text-[7rem] sm:text-[11rem]">परिवार</span>
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{a.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{a.lead}</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <AbroadPlanner homeCity={user.city} />
        <aside aria-labelledby="how-h" className="h-fit rounded-[4px] border border-line bg-surface p-6">
          <h2 id="how-h" className="font-display text-xl font-bold">{a.how}</h2>
          <ol className="mt-4 space-y-4">
            {a.steps.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent font-bold text-accent-contrast">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
