import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";
import type { Dict, Lang } from "@/lib/i18n/dict";
import type { User } from "@/lib/store/types";
import type { StatusMap } from "./center";

type Item = { key: keyof Dict["verify"]["profileItems"]; done: boolean; pending?: boolean };

/** How much of the profile is filled in. Only facts from the account and the verification checks. */
export function profileItems(user: User, s: StatusMap): Item[] {
  const isProvider = user.roles.includes("provider");
  const ok = (k: keyof StatusMap) => s[k].status === "verified";
  const wait = (k: keyof StatusMap) => s[k].status === "pending";
  return [
    { key: "account", done: !!user.name },
    { key: "contact", done: ok("phone") || !!user.email },
    { key: "region", done: !!user.city },
    ...(isProvider ? [{ key: "skills" as const, done: (user.categories?.length ?? 0) > 0 }] : []),
    { key: "id", done: ok("id"), pending: wait("id") },
    { key: "selfie", done: ok("selfie"), pending: wait("selfie") },
    { key: "address", done: ok("address"), pending: wait("address") },
  ];
}

export function ProfileProgress({ user, status, t }: { user: User; status: StatusMap; t: Dict; lang: Lang }) {
  const v = t.verify;
  const items = profileItems(user, status);
  const pct = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return (
    <section aria-labelledby="profile-pct-h" className="mb-8 rounded-[12px] border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id="profile-pct-h" className="font-display text-xl font-bold">
            {v.profileTitle}: <span className="text-accent">{v.profilePct(pct)}</span>
          </h2>
          <div className="mt-3 h-3 w-full max-w-xl overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={v.profilePct(pct)}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
            {items.map((i) => (
              <li key={i.key} className={`inline-flex items-center gap-1.5 ${i.done ? "font-semibold" : "text-muted"}`}>
                {i.done ? <Check size={15} aria-hidden className="text-accent" />
                  : i.pending ? <Clock size={15} aria-hidden className="text-marigold" />
                  : <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-line" aria-hidden />}
                {v.profileItems[i.key]}{i.pending && !i.done ? ` (${v.inReview})` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 sm:max-w-[15rem] sm:text-right">
          <Link href="/" className="btn btn-ghost">{v.skip} <ArrowRight size={17} aria-hidden /></Link>
          <p className="mt-2 text-xs text-muted">{v.skipNote}</p>
        </div>
      </div>
    </section>
  );
}
