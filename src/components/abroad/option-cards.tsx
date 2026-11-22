import Link from "next/link";
import { HeartHandshake, Plane } from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";

export type AbroadChoice = "family" | "workers";

/** The two ways to use "Hire from abroad". */
export function OptionCards({ t, active }: { t: Dict; active: AbroadChoice }) {
  const j = t.abroadJobs;
  const options = [
    { key: "family", Icon: HeartHandshake },
    { key: "workers", Icon: Plane },
  ] as const;
  return (
    <nav aria-label={j.choose}>
      <h2 className="font-display mb-3 text-2xl font-bold">{j.choose}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {options.map(({ key, Icon }) => (
          <li key={key}>
            <Link
              href={`/abroad?for=${key}`}
              scroll={false}
              aria-current={active === key ? "page" : undefined}
              className={`flex h-full items-start gap-4 rounded-[14px] border-2 p-5 transition-colors ${active === key ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong"}`}
            >
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${active === key ? "bg-accent text-accent-contrast" : "bg-accent-soft text-accent"}`}
              >
                <Icon size={24} aria-hidden />
              </span>
              <span>
                <span className="font-display block text-xl font-bold">{j.options[key].title}</span>
                <span className="text-muted mt-1 block text-sm">{j.options[key].body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
