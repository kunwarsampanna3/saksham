import Link from "next/link";
import { Globe2, MapPin } from "lucide-react";
import { Contours } from "@/components/contours";
import { VerifiedStamp } from "@/components/browse/cards";
import { AbroadWorkRecord } from "@/components/abroad/work-record";
import type { WorkRecord } from "@/lib/abroad";
import type { User } from "@/lib/store/types";
import { initials } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n/dict";

/** Profile for people without a service profile, e.g. recruiters and workers abroad. No contact details. */
export function MemberProfile({
  person,
  records,
  self,
  t,
  lang,
}: {
  person: User;
  records: WorkRecord[];
  self: boolean;
  t: Dict;
  lang: Lang;
}) {
  return (
    <div>
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={33} centers={1} rings={8} />
        <div className="relative mx-auto flex max-w-[88rem] flex-wrap items-center gap-5 px-4 py-10 sm:px-6">
          <span
            aria-hidden
            className="bg-forest font-display inline-flex h-24 w-24 items-center justify-center rounded-[6px] text-3xl font-bold text-white"
          >
            {initials(person.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {person.isDemo && <span className="demo-tag">{t.common.exampleAccount}</span>}
              {person.verified && <VerifiedStamp label={t.browse.verified} />}
            </div>
            <h1 className="font-display mt-1 text-4xl font-extrabold">{person.name}</h1>
            {person.headline ? (
              <p className="text-muted text-lg">{person.headline}</p>
            ) : (
              <p className="text-muted inline-flex items-center gap-1">
                <MapPin size={15} aria-hidden /> {person.city}
              </p>
            )}
          </div>
          {self && (
            <Link href="/abroad?for=workers" className="btn btn-ghost">
              <Globe2 size={17} aria-hidden /> {t.abroadJobs.back}
            </Link>
          )}
        </div>
      </div>
      <div className="mx-auto max-w-[88rem] px-4 py-10 sm:px-6">
        <AbroadWorkRecord records={records} self={self} t={t} lang={lang} />
      </div>
    </div>
  );
}
