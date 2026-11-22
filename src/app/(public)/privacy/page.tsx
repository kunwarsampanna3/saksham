import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Privacy Policy" };

/** Plain-language draft privacy policy matching what the code does. Not legal advice — review before launch. */
export default function Privacy() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Logo />
      <p className="demo-tag mt-8 inline-block">Draft for review</p>
      <h1 className="font-display mt-3 text-4xl font-extrabold">Saksham Privacy Policy</h1>
      <p className="mt-3 text-muted">This draft describes what Saksham collects and why. It must be reviewed by a lawyer before Saksham launches publicly.</p>
      <div className="mt-8 space-y-6 text-[1.02rem] leading-relaxed">
        <section><h2 className="font-display text-xl font-bold">What we collect</h2>
          <p className="mt-2">Your mobile number or email, name, city and area, the categories you choose, your tasks, offers, messages and payments on Saksham, and — if you verify — ID photos and a selfie.</p></section>
        <section><h2 className="font-display text-xl font-bold">How it is protected</h2>
          <p className="mt-2">Your MPIN is stored only as a secure hash. ID photos and selfies are kept in private storage, have location data removed, and are deleted 90 days after a decision. Phone numbers and emails are hidden from other users until you book each other.</p></section>
        <section><h2 className="font-display text-xl font-bold">How we use it</h2>
          <p className="mt-2">To run your account, match tasks and applicants, hold payments in escrow, keep people safe and resolve disputes. We send product updates or offers only if you ticked that box, and you can stop them at any time.</p></section>
        <section><h2 className="font-display text-xl font-bold">Saksham AI</h2>
          <p className="mt-2">When you use AI features, the text you type is sent to our AI provider to draft a task or answer a question. AI never decides prices, rankings, credit or payments.</p></section>
        <section><h2 className="font-display text-xl font-bold">Sharing</h2>
          <p className="mt-2">We do not sell your data. We share it only with the people you work with on Saksham, with service providers that run Saksham (hosting, SMS, email, payments), or when the law requires it.</p></section>
        <section><h2 className="font-display text-xl font-bold">Your choices</h2>
          <p className="mt-2">You can update your details, withdraw verification documents, or ask us to delete your account through the Contact page.</p></section>
      </div>
      <p className="mt-10 text-sm text-muted">See also the <Link href="/terms" className="font-semibold text-accent hover:underline">Terms</Link>.</p>
    </main>
  );
}
