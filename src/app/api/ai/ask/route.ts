import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guard, fail } from "@/lib/auth/http";
import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { aiAnswer } from "@/lib/ai/claude";

const Body = z.object({
  question: z.string().trim().min(2).max(500),
  lang: z.enum(["en", "ne"]).default("en"),
  context: z.string().max(500).optional(),
});

const FALLBACK = {
  en: "I can't answer right now. Try the Help pages, or ask in Messages and our team will reply.",
  ne: "अहिले जवाफ दिन सकिनँ। सहायता पृष्ठ हेर्नुहोस्, वा सन्देशमा सोध्नुहोस्।",
};

/** Offline answers (plain text, written by hand) used when the AI is unavailable or not configured. */
const FAQ: { re: RegExp; en: string; ne: string }[] = [
  { re: /escrow|एस्क्रो|hold|safe pay/i,
    en: "When you book, your payment goes into escrow (sandbox in this demo). The applicant sees it's secured, does the work, and you release it when you're happy. You can pay in full, in two halves, or 30-40-30.",
    ne: "बुक गर्दा तपाईंको भुक्तानी एस्क्रोमा बस्छ (यो डेमोमा स्यान्डबक्स)। काम चित्तबुझ्दो भएपछि मात्र तपाईं रकम छोड्नुहुन्छ। पूरा, दुई भाग वा ३०-४०-३० मा तिर्न सकिन्छ।" },
  { re: /fair|price|range|मूल्य|दायरा/i,
    en: "The fair range comes from Saksham's price table: the category's typical price, quantity, extra days and a city cost factor. Plain code works it out — the AI never sets prices.",
    ne: "उचित दायरा सक्षमको मूल्य तालिकाबाट आउँछ: कामको सामान्य मूल्य, संख्या, थप दिन र सहरको खर्च। यो साधारण कोडले निकाल्छ — AI ले मूल्य तोक्दैन।" },
  { re: /verif|\bid\b|selfie|प्रमाण/i,
    en: "Open Verification from your profile menu. Add your phone, an ID photo and a selfie to earn the Verified stamp. Documents stay private.",
    ne: "प्रोफाइल मेनुबाट प्रमाणीकरण खोल्नुहोस्। फोन, परिचयपत्रको फोटो र सेल्फी थप्दा प्रमाणित छाप पाइन्छ। कागजात गोप्य रहन्छन्।" },
  { re: /release|छोड्|pay|भुक्तानी/i,
    en: "Open the booking's payment schedule. When the applicant marks a step delivered, press Release and enter your MPIN.",
    ne: "बुकिङको भुक्तानी तालिका खोल्नुहोस्। आवेदकले काम बुझाएपछि 'छोड्नुहोस्' थिचेर MPIN हाल्नुहोस्।" },
  { re: /sos|safety|unsafe|सुरक्षा/i,
    en: "The Safety page has SOS, trusted contacts, reporting and blocking. In an emergency call Police 100 or Ambulance 102.",
    ne: "सुरक्षा पृष्ठमा SOS, विश्वासिलो सम्पर्क, रिपोर्ट र ब्लक छन्। आपतकालमा प्रहरी १०० वा एम्बुलेन्स १०२ मा फोन गर्नुहोस्।" },
  { re: /abroad|family|विदेश|परिवार/i,
    en: "Use Hire from abroad: describe the job, pay in NPR into escrow, and share a private link so your family can confirm the work.",
    ne: "'विदेशबाट काम लगाउनुहोस्' प्रयोग गर्नुहोस्: काम लेख्नुहोस्, नेपाली रुपैयाँमा एस्क्रोमा तिर्नुहोस्, र परिवारलाई पुष्टि गर्ने गोप्य लिंक पठाउनुहोस्।" },
];

/** Saksham AI assistant: short answers (<60 words) in the user's language. */
export async function POST(req: NextRequest) {
  const g = await guard(req, { name: "ai-ask", schema: Body, limit: 20 });
  if ("res" in g) return g.res;
  const s = await getSession();
  if (!s) return fail(401, "signed_out");
  const rl = rateLimit(`ai-ask-user:${s.sub}`, 60, 3600);
  if (!rl.ok) return fail(429, "rate_limited", { retryAfter: rl.retryAfter });

  const answer = await aiAnswer(g.data.question, g.data.lang, g.data.context);
  if (answer) return NextResponse.json({ ok: true, source: "ai", answer });
  const faq = FAQ.find((f) => f.re.test(g.data.question));
  return NextResponse.json({ ok: true, source: "fallback", answer: faq ? faq[g.data.lang] : FALLBACK[g.data.lang] });
}
