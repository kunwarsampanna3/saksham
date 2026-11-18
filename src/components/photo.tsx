import Image from "next/image";
import { photo, type PhotoKey } from "@/lib/photos";
import { getDict } from "@/lib/i18n/server";

/**
 * A credited, licence-labelled photo. Fills its parent (give the parent a size/aspect).
 * Shows "Sample photo" for stand-ins and a small credit linking to the source and licence.
 * Falls back to a forest panel if the file is missing.
 */
export async function Photo({
  k, sizes, priority = false, className = "", credit = "overlay", creditAt = "bottom", creditLink = true,
}: { creditLink?: boolean; k: PhotoKey; sizes: string; priority?: boolean; className?: string; credit?: "overlay" | "none"; creditAt?: "bottom" | "top" }) {
  const { t, lang } = await getDict();
  const p = photo(k);
  if (!p) return <div className={`absolute inset-0 bg-forest ${className}`} aria-hidden />;
  return (
    <figure className={`absolute inset-0 m-0 ${className}`}>
      <Image
        src={p.src}
        alt={p.alt[lang]}
        fill
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className="object-cover"
        style={{ objectPosition: p.focus ?? "50% 50%" }}
      />
      {p.isSample && (
        <span className="demo-tag absolute left-2.5 top-2.5 z-10 !border-white/40 !bg-black/55 !text-white">{t.common.samplePhoto}</span>
      )}
      {credit === "overlay" && (
        <figcaption className={`absolute ${creditAt === "top" ? "top-0" : "bottom-0"} right-0 z-10 max-w-full truncate bg-black/55 px-2 py-0.5 text-[0.68rem] text-white/90`}>
          {creditLink ? (
            <a href={p.source} target="_blank" rel="noopener noreferrer license" className="hover:underline">
              {t.home.photoBy(p.credit, p.license)}
            </a>
          ) : t.home.photoBy(p.credit, p.license)}
        </figcaption>
      )}
    </figure>
  );
}
