/**
 * Hand-made price table (NPR). Plain code decides prices — the AI never does.
 * Figures are EXAMPLE starting points for review, editable from /admin (step 9).
 * `low`/`high` are for a typical small job of `unit`; `perDay` scales multi-day work.
 */
export const CATEGORIES = [
  // IT skills first: Saksham features IT students, but every trade is welcome.
  { id: "web-design", en: "Websites & design", ne: "वेबसाइट र डिजाइन", unit: "project", low: 8000, high: 45000, perDay: 4000, online: true,
    keywords: ["website", "web", "logo", "design", "facebook page", "instagram", "online shop", "वेबसाइट", "लोगो", "डिजाइन"] },
  { id: "coding", en: "Programming & apps", ne: "प्रोग्रामिङ र एप", unit: "project", low: 10000, high: 60000, perDay: 4000, online: true,
    keywords: ["mobile app", "android app", "web app", "code", "coding", "program", "python", "javascript", "react", "java", "database", "software", "bug", "api", "एप", "कोड", "प्रोग्राम", "सफ्टवेयर"] },
  { id: "it-support", en: "Computer & IT support", ne: "कम्प्युटर र IT सहयोग", unit: "visit", low: 600, high: 3500, perDay: 2500, online: false,
    keywords: ["computer", "wifi", "internet", "router", "printer", "windows", "install", "virus", "network", "setup", "कम्प्युटर", "इन्टरनेट", "प्रिन्टर", "वाइफाइ"] },
  { id: "phone-repair", en: "Phone & laptop repair", ne: "फोन र ल्यापटप मर्मत", unit: "device", low: 800, high: 6000, perDay: 3000, online: false,
    keywords: ["phone", "mobile", "screen", "laptop", "battery", "charging", "repair", "फोन", "मोबाइल", "ल्यापटप", "स्क्रिन", "मर्मत", "बिग्रि"] },
  { id: "digital-marketing", en: "Social media & marketing", ne: "सोसल मिडिया र मार्केटिङ", unit: "project", low: 3000, high: 20000, perDay: 2000, online: true,
    keywords: ["social media", "marketing", "seo", "facebook ads", "boost", "tiktok", "youtube", "content", "post design", "मार्केटिङ", "सोसल मिडिया", "विज्ञापन"] },
  { id: "tutoring", en: "Tutoring", ne: "ट्युसन", unit: "session", low: 500, high: 1500, perDay: 1500, online: true,
    keywords: ["tutor", "teach", "class", "math", "science", "english", "see", "+2", "ट्युसन", "पढाउ", "गणित", "विज्ञान"] },
  { id: "translation", en: "Writing & translation", ne: "लेखन र अनुवाद", unit: "page", low: 400, high: 1500, perDay: 3000, online: true,
    keywords: ["translate", "translation", "write", "cv", "resume", "content", "अनुवाद", "लेख"] },
  { id: "tailoring", en: "Tailoring & alterations", ne: "सिलाइ र मर्मत", unit: "item", low: 600, high: 2500, perDay: 1800, online: false,
    keywords: ["tailor", "stitch", "sew", "kurta", "blouse", "dress", "alteration", "सिलाइ", "दर्जी", "कुर्ता", "चोलो", "लुगा"] },
  { id: "electrician", en: "Electrician", ne: "बिजुली मिस्त्री", unit: "visit", low: 700, high: 4000, perDay: 3500, online: false,
    keywords: ["electric", "wiring", "light", "fan", "switch", "inverter", "बिजुली", "बत्ती", "पंखा", "वायरिङ"] },
  { id: "plumbing", en: "Plumbing", ne: "प्लम्बिङ", unit: "visit", low: 700, high: 4500, perDay: 3500, online: false,
    keywords: ["plumb", "tap", "leak", "pipe", "toilet", "tank", "धारा", "पाइप", "चुहि", "ट्याङ्की"] },
  { id: "cleaning", en: "Home cleaning", ne: "घर सफाइ", unit: "visit", low: 1200, high: 5000, perDay: 2500, online: false,
    keywords: ["clean", "cleaning", "wash", "sofa", "carpet", "सफा", "सफाइ", "धुने"] },
  { id: "moving", en: "Moving & delivery", ne: "सामान सार्ने", unit: "trip", low: 1500, high: 9000, perDay: 6000, online: false,
    keywords: ["move", "shift", "delivery", "truck", "carry", "सार्ने", "ढुवानी", "डेलिभरी"] },
  { id: "photography", en: "Photo & video", ne: "फोटो र भिडियो", unit: "event", low: 4000, high: 25000, perDay: 12000, online: false,
    keywords: ["photo", "video", "wedding", "shoot", "product photo", "फोटो", "भिडियो", "बिहे"] },
  { id: "beauty", en: "Beauty & mehendi", ne: "ब्युटी र मेहन्दी", unit: "visit", low: 1000, high: 8000, perDay: 6000, online: false,
    keywords: ["makeup", "mehendi", "henna", "hair", "bridal", "मेकअप", "मेहन्दी", "कपाल"] },
  { id: "elder-care", en: "Care & errands for family", ne: "परिवारको हेरचाह र काम", unit: "day", low: 1200, high: 3500, perDay: 2500, online: false,
    keywords: ["care", "elder", "parents", "hospital", "medicine", "errand", "हेरचाह", "आमा", "बुबा", "अस्पताल", "औषधि"] },
  { id: "other", en: "Other", ne: "अन्य", unit: "job", low: 1000, high: 6000, perDay: 3000, online: false, keywords: [] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];
export const category = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];

/** City cost multipliers (example). Valley cities cost a little more; online work is location-free. */
const CITY_FACTOR: Record<string, number> = {
  Kathmandu: 1.1, Lalitpur: 1.08, Bhaktapur: 1.0, Pokhara: 1.05, Biratnagar: 0.95, Bharatpur: 0.95, Butwal: 0.92, Dharan: 0.95,
};

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export interface FairRange { low: number; high: number; mid: number; basis: string[] }

/** Fair price range for a task. Deterministic and explainable — each factor is listed in `basis`. */
/** Units priced per piece: quantity multiplies the price and days are only the timeline. */
const COUNTABLE = new Set(["item", "page", "device"]);
export const isCountable = (categoryId: string) => COUNTABLE.has(category(categoryId).unit);

export interface PriceOverrideLite { low: number; high: number; perDay: number }

/** `override` = an admin edit of this category's row (from /admin). Still plain code. */
export function fairRange(input: { category: string; days: number; quantity?: number; city?: string; online?: boolean; override?: PriceOverrideLite }): FairRange {
  const c = { ...category(input.category), ...(input.override ?? {}) };
  const days = Math.min(Math.max(Math.round(input.days || 1), 1), 60);
  // Sessions (tutoring) are counted like pieces: one session per day unless a count was given.
  const perSession = c.unit === "session";
  const qty = COUNTABLE.has(c.unit) ? Math.min(Math.max(Math.round(input.quantity || 1), 1), 500)
    : perSession ? Math.min(Math.max(Math.round(input.quantity || 0), days, 1), 200) : 1;
  const cityF = input.online ? 1 : CITY_FACTOR[input.city ?? ""] ?? 1;
  // Countable work: price × quantity, 10% bulk discount above 3 pieces. Time-based work: extra days add cost.
  const qtyF = qty <= 3 ? qty : qty * 0.9;
  // A per-project price already covers its timeline, so only time-based units add day costs.
  const extra = COUNTABLE.has(c.unit) || perSession || c.unit === "project" ? 0 : (days - 1) * c.perDay;
  const low = roundTo((c.low * qtyF + extra * 0.8) * cityF, 100);
  const high = roundTo((c.high * qtyF + extra * 1.2) * cityF, 100);
  const basis = [
    `${c.en}: Rs. ${c.low.toLocaleString("en-IN")}–${c.high.toLocaleString("en-IN")} per ${c.unit}`,
    ...(qty > 1 ? [`${qty} ${c.unit}s${qty > 3 ? " with a 10% bulk discount" : ""}`] : []),
    ...(extra > 0 ? [`${days} days → + Rs. ${c.perDay.toLocaleString("en-IN")} per extra day`] : []),
    ...(cityF !== 1 ? [`${input.city} cost factor ×${cityF}`] : []),
    ...(input.online ? ["Online work: no location factor"] : []),
  ];
  return { low, high, mid: roundTo((low + high) / 2, 100), basis };
}

/** Example platform fee. */
export const FEE_RATE = 0.07;
export const fee = (amount: number) => Math.round(amount * FEE_RATE);
