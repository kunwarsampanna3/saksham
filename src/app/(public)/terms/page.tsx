import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Terms" };

/** Plain-language draft terms that describe how Saksham actually works. Not legal advice — review before launch. */
export default function Terms() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Logo />
      <p className="demo-tag mt-8 inline-block">Draft for review</p>
      <h1 className="font-display mt-3 text-4xl font-extrabold">Saksham Terms</h1>
      <p className="text-muted mt-3">
        These draft terms explain, in plain language, how Saksham works today. They are not final and must be
        reviewed by a lawyer before Saksham launches publicly.
      </p>
      <div className="mt-8 space-y-6 text-[1.02rem] leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-bold">1. What Saksham is</h2>
          <p className="mt-2">
            Saksham is a marketplace that connects people who need a task done (recruiters) with people who
            offer skills (applicants). Saksham is not the provider of the work and does not employ applicants.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">2. Your account</h2>
          <p className="mt-2">
            You sign up with a mobile number or email that you control, and set a 4-digit MPIN. Keep your MPIN
            and codes secret; Saksham staff will never ask for them. One person per account.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">3. Prices and offers</h2>
          <p className="mt-2">
            Saksham shows a fair price range worked out from a public price table. Applicants set their own
            offers. The recruiter chooses which offer to accept.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">4. Payments and escrow</h2>
          <p className="mt-2">
            To post a job, a recruiter pays Rs. 1,000 for 3 days or Rs. 4,000 for 10 days. If nobody is hired,
            the post stays up 5 more days free and is then removed. The posting fee is not refunded. On
            hiring, the recruiter pays 50% of the agreed price: Saksham pays 30% to the applicant and holds
            20%. When the applicant reports that half of the work is finished, the recruiter pays the other
            50% and the applicant is paid another 30%. The last 40% is paid when the recruiter approves the
            finished work. Money already paid to the applicant cannot be refunded through a dispute. Saksham
            keeps 7% of an applicant&apos;s income when it is withdrawn. In this preview, eSewa, Khalti and
            cards are a labelled sandbox and no real money moves.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">5. Disputes</h2>
          <p className="mt-2">
            If work is not as agreed, either party can open a dispute. The payment is frozen while Saksham
            arranges a redo or a refund of what is still in escrow.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">6. Acceptable use</h2>
          <p className="mt-2">
            No fraud, harassment, fake profiles or reviews, unsafe work, or asking to pay outside Saksham.
            Reports go to Saksham&apos;s trust and safety team, who may suspend accounts.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">7. Ratings</h2>
          <p className="mt-2">
            Only recruiters who paid for a job through Saksham can rate it. Ratings must be honest.
          </p>
        </section>
      </div>
      <p className="text-muted mt-10 text-sm">
        See also the{" "}
        <Link href="/privacy" className="text-accent font-semibold hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </main>
  );
}
