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
      <div className="border-line relative overflow-hidden border-b">
        <Contours seed={52} centers={1} rings={8} />
        <div className="relative mx-auto max-w-[88rem] px-4 pt-10 pb-8 sm:px-6">
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{c.title}</h1>
          <p className="text-muted mt-2 max-w-2xl text-lg">{c.lead}</p>
        </div>
      </div>
      <div className="mx-auto grid max-w-[88rem] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_24rem]">
        <ContactForm />
        <aside
          aria-labelledby="other-h"
          className="border-line bg-surface h-fit space-y-5 rounded-[4px] border p-6"
        >
          <h2 id="other-h" className="font-display text-xl font-bold">
            {c.other}
          </h2>
          {email || phone ? (
            <ul className="space-y-3">
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="text-accent inline-flex items-center gap-2 font-semibold hover:underline"
                  >
                    <Mail size={18} aria-hidden /> {email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="text-accent inline-flex items-center gap-2 font-semibold hover:underline"
                  >
                    <Phone size={18} aria-hidden /> {phone}
                  </a>
                  <span className="text-muted block text-sm">{c.hours}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-muted text-sm">{c.notSet}</p>
          )}
          <div>
            <p className="inline-flex items-center gap-2 font-semibold">
              <MessageCircleQuestion size={18} aria-hidden className="text-accent" /> {c.ask}
            </p>
            <p className="text-muted text-sm">{c.askLead}</p>
          </div>
          <ul className="space-y-2">
            <li>
              <Link
                href="/safety#report"
                className="text-accent inline-flex items-center gap-2 font-semibold hover:underline"
              >
                <Flag size={18} aria-hidden /> {c.report}
              </Link>
            </li>
            <li>
              <Link
                href="/safety"
                className="text-accent inline-flex items-center gap-2 font-semibold hover:underline"
              >
                <ShieldAlert size={18} aria-hidden /> {c.safety}
              </Link>
            </li>
          </ul>
          <p className="bg-surface-2 rounded-[4px] p-3 text-sm font-semibold">{c.emergency}</p>
        </aside>
      </div>
    </div>
  );
}
