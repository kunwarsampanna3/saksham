import type { Metadata } from "next";
import { CreditCard, HeartHandshake, MessageSquareText, ShieldCheck } from "lucide-react";
import { Contours } from "@/components/contours";
import { AbroadPlanner } from "@/components/abroad/planner";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Hire from abroad" };

const ICONS = [MessageSquareText, ShieldCheck, HeartHandshake, CreditCard];

export default async function AbroadPage() {
  const [user, { t }] = await Promise.all([requireUser("/abroad"), getDict()]);
  const a = t.abroad2;
  const s = a.simple;
  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={21} centers={2} rings={9} />
        <span lang="ne" aria-hidden className="deva-giant absolute -right-4 top-2 text-[7rem] sm:text-[11rem]">परिवार</span>
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-wider text-accent">{s.kicker}</p>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{a.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{a.lead}</p>
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] space-y-8 px-4 py-10 sm:px-6">
        {/* the whole idea in four steps */}
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {s.steps.map((st, i) => {
            const Icon = ICONS[i] ?? ShieldCheck;
            return (
              <li key={st.t} className="relative rounded-[14px] border border-line bg-surface p-5">
                <span className="absolute right-4 top-4 font-display text-3xl font-extrabold text-line">{i + 1}</span>
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent"><Icon size={22} aria-hidden /></span>
                <h2 className="font-display mt-3 text-lg font-bold">{st.t}</h2>
                <p className="mt-1 text-sm text-muted">{st.b}</p>
              </li>
            );
          })}
        </ol>

        <p className="rounded-[12px] border-l-4 border-accent bg-accent-soft p-4 text-[0.95rem]">
          <strong>{s.exampleTitle}: </strong>{s.example} <span className="demo-tag ml-1">{t.browse.example}</span>
        </p>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            <h2 className="font-display mb-3 text-2xl font-bold">{s.startTitle}</h2>
            <AbroadPlanner homeCity={user.city} />
          </div>
          <aside aria-labelledby="faq-h" className="h-fit rounded-[14px] border border-line bg-surface p-5">
            <h2 id="faq-h" className="font-display text-xl font-bold">{s.faqTitle}</h2>
            <dl className="mt-3 divide-y divide-line">
              {s.faq.map((f) => (
                <div key={f.q} className="py-3">
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="mt-1 text-sm text-muted">{f.a}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}
