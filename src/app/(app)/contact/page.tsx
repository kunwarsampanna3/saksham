import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone, ShieldAlert, Flag, MessageCircleQuestion } from "lucide-react";
import { Contours } from "@/components/contours";
import { ContactForm } from "@/components/contact-form";
import { requireUser } from "@/lib/auth/current-user";
import { getDict } from "@/lib/i18n/server";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const [, { t }] = await Promise.all([requireUser("/contact"), getDict()]);
  const c = t.contactPage;
  const { email, phone } = config.support;
  return (
    <div>
      <div className="relative overflow-hidden border-b border-line">
        <Contours seed={52} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pb-8 pt-10 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{c.title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">{c.lead}</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_24rem]">
        <ContactForm />
        <aside aria-labelledby="other-h" className="h-fit space-y-5 rounded-[4px] border border-line bg-surface p-6">
          <h2 id="other-h" className="font-display text-xl font-bold">{c.other}</h2>
          {email || phone ? (
            <ul className="space-y-3">
              {email && <li><a href={`mailto:${email}`} className="inline-flex items-center gap-2 font-semibold text-accent hover:underline"><Mail size={18} aria-hidden /> {email}</a></li>}
              {phone && <li><a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 font-semibold text-accent hover:underline"><Phone size={18} aria-hidden /> {phone}</a><span className="block text-sm text-muted">{c.hours}</span></li>}
            </ul>
          ) : <p className="text-sm text-muted">{c.notSet}</p>}
          <div>
            <p className="inline-flex items-center gap-2 font-semibold"><MessageCircleQuestion size={18} aria-hidden className="text-accent" /> {c.ask}</p>
            <p className="text-sm text-muted">{c.askLead}</p>
          </div>
          <ul className="space-y-2">
            <li><Link href="/safety#report" className="inline-flex items-center gap-2 font-semibold text-accent hover:underline"><Flag size={18} aria-hidden /> {c.report}</Link></li>
            <li><Link href="/safety" className="inline-flex items-center gap-2 font-semibold text-accent hover:underline"><ShieldAlert size={18} aria-hidden /> {c.safety}</Link></li>
          </ul>
          <p className="rounded-[4px] bg-surface-2 p-3 text-sm font-semibold">{c.emergency}</p>
        </aside>
      </div>
    </div>
  );
}
