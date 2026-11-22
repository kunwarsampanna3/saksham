import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PHOTOS } from "@/lib/photos";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Photo credits" };

export default function Credits() {
  const rows = Object.entries(PHOTOS);
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Logo />
      <h1 className="font-display mt-8 text-4xl font-extrabold">Photo credits</h1>
      <p className="text-muted mt-3">
        Saksham only uses its own, consented, or openly licensed photos. Stand-in photos are labelled “Sample
        photo” and are never presented as real applicants or testimonials. The photos below come from
        Wikimedia Commons and were resized and converted to WebP; CC BY-SA files are shared under the same
        licence.
      </p>
      <ul className="divide-line border-line mt-8 divide-y border-y">
        {rows.map(([key, p]) => (
          <li key={key} className="flex gap-4 py-4">
            <div className="bg-surface-2 relative h-16 w-24 shrink-0 overflow-hidden">
              <Image src={p.src} alt="" fill sizes="96px" className="object-cover" />
            </div>
            <div>
              <p className="font-semibold">{p.alt.en}</p>
              <p className="text-muted text-sm">
                {p.credit} ·{" "}
                <a
                  href={p.licenseUrl}
                  className="text-accent hover:underline"
                  rel="license noopener"
                  target="_blank"
                >
                  {p.license}
                </a>{" "}
                ·{" "}
                <a href={p.source} className="text-accent hover:underline" rel="noopener" target="_blank">
                  Source
                </a>
                {p.isSample ? " · Sample photo" : ""}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-8">
        <Link href="/" className="text-accent font-semibold hover:underline">
          ← Back to Saksham
        </Link>
      </p>
    </main>
  );
}
