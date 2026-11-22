import type { Metadata } from "next";
import { CreditCard, HeartHandshake, MessageSquareText, ShieldCheck } from "lucide-react";
import { Contours } from "@/components/contours";
import { AbroadPlanner } from "@/components/abroad/planner";
import { JobsBoard } from "@/components/abroad/jobs-board";
import { OptionCards, type AbroadChoice } from "@/components/abroad/option-cards";
import { ensureAbroadDemo } from "@/lib/seed/abroad-demo";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Hire from abroad" };

const ICONS = [MessageSquareText, ShieldCheck, HeartHandshake, CreditCard];

export default async function AbroadPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string; country?: string }>;
}) {
  const [user, { t, lang }, sp] = await Promise.all([requireUser("/abroad"), getDict(), searchParams]);
  if (user.isDemo) await ensureAbroadDemo();
  const choice: AbroadChoice =
    sp.for === "workers" || sp.for === "family"
      ? sp.for
      : user.activeRole === "provider"
        ? "workers"
        : "family";
  const a = t.abroad2;
  const s = a.simple;
  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={21} centers={2} rings={9} />
        <span
          lang="ne"
          aria-hidden
          className="deva-giant absolute top-2 -right-4 text-[7rem] sm:text-[11rem]"
        >
          {choice === "family" ? "परिवार" : "परदेश"}
        </span>
        <div className="relative mx-auto max-w-[88rem] px-4 pt-10 pb-8 sm:px-6">
          <p className="text-accent text-xs font-bold tracking-wider uppercase">{s.kicker}</p>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{a.title}</h1>
          <p className="text-muted mt-2 max-w-2xl text-lg">
            {choice === "family" ? a.lead : t.abroadJobs.options.workers.body}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] px-4 pt-8 sm:px-6">
        <OptionCards t={t} active={choice} />
      </div>
      {choice === "workers" && (
        <div className="mx-auto max-w-[88rem] px-4 py-8 sm:px-6">
          <JobsBoard t={t} lang={lang} user={user} country={sp.country} />
        </div>
      )}
      <div hidden={choice !== "family"} className="mx-auto max-w-[88rem] space-y-8 px-4 py-8 sm:px-6">
        {/* the whole idea in four steps */}
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {s.steps.map((st, i) => {
            const Icon = ICONS[i] ?? ShieldCheck;
            return (
              <li key={st.t} className="border-line bg-surface relative rounded-[14px] border p-5">
                <span className="font-display text-line absolute top-4 right-4 text-3xl font-extrabold">
                  {i + 1}
                </span>
                <span className="bg-accent-soft text-accent grid h-11 w-11 place-items-center rounded-xl">
                  <Icon size={22} aria-hidden />
                </span>
                <h2 className="font-display mt-3 text-lg font-bold">{st.t}</h2>
                <p className="text-muted mt-1 text-sm">{st.b}</p>
              </li>
            );
          })}
        </ol>

        <p className="border-accent bg-accent-soft rounded-[12px] border-l-4 p-4 text-[0.95rem]">
          <strong>{s.exampleTitle}: </strong>
          {s.example} <span className="demo-tag ml-1">{t.browse.example}</span>
        </p>

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            <h2 className="font-display mb-3 text-2xl font-bold">{s.startTitle}</h2>
            <AbroadPlanner homeCity={user.city} />
          </div>
          <aside aria-labelledby="faq-h" className="border-line bg-surface h-fit rounded-[14px] border p-5">
            <h2 id="faq-h" className="font-display text-xl font-bold">
              {s.faqTitle}
            </h2>
            <dl className="divide-line mt-3 divide-y">
              {s.faq.map((f) => (
                <div key={f.q} className="py-3">
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="text-muted mt-1 text-sm">{f.a}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}
