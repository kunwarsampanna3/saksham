import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { LangSwitch } from "@/components/prefs-controls";
import { ConfirmForm } from "@/components/abroad/confirm-form";
import { getDict } from "@/lib/i18n/server";
import { store } from "@/lib/store";
import { bookingForToken, confirmable } from "@/lib/family";
import { rs } from "@/lib/format";

export const metadata: Metadata = { title: "Confirm the work", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public page for a family member in Nepal (no account). Shows only what they need to confirm. */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t, lang } = await getDict();
  const c = t.confirm;
  const b = await bookingForToken(token);
  const task = b ? await store.getTask(b.taskId) : null;
  const client = b ? await store.getUserById(b.clientId) : null;
  const pending = b ? confirmable(b) : [];

  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Logo />
        <LangSwitch />
      </div>
      {!b || !task ? (
        <p className="border-line-strong mt-10 rounded-[4px] border border-dashed p-6 text-center font-semibold">
          {c.invalid}
        </p>
      ) : (
        <article className="notch-frame mt-8">
          <div className="notch-card terrace-edge p-6">
            <h1 className="font-display text-3xl font-extrabold">{c.title}</h1>
            <p className="text-muted mt-2 text-lg">
              {c.lead(b.family?.name ?? "", client?.name.split(" ")[0] ?? "")}
            </p>
            <dl className="mt-5 space-y-2 text-[0.95rem]">
              <div>
                <dt className="text-muted text-xs font-semibold tracking-wider uppercase">{c.task}</dt>
                <dd className="font-semibold">{task.title}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs font-semibold tracking-wider uppercase">{c.provider}</dt>
                <dd className="font-semibold">{b.providerName}</dd>
              </div>
            </dl>
            {pending.length === 0 ? (
              <p className="bg-surface-2 mt-6 rounded-[4px] p-4">{c.nothing}</p>
            ) : (
              <ul className="mt-6 space-y-4">
                {pending.map((i) => {
                  const done = b.family?.confirmations.find((x) => x.installmentId === i.id);
                  return (
                    <li key={i.id} className="border-line rounded-[4px] border p-4">
                      <p className="text-muted text-sm">
                        {c.step}:{" "}
                        {i.label === "kept"
                          ? t.market.money.halfStep
                          : `${t.booking.labels[i.label]} · ${rs(i.amount, lang)}`}
                      </p>
                      <ConfirmForm token={token} installmentId={i.id} already={done ? done.ok : null} />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </article>
      )}
    </main>
  );
}
