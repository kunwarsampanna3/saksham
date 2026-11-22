import "server-only";
import { config } from "@/lib/config";
import { store } from "@/lib/store";
import type { AbroadJob, User } from "@/lib/store/types";
import { withLock } from "@/lib/lock";
import { DEMO_PERSONAS, demoSeed, type DemoPersona } from "@/lib/auth/demo";
import { applyToJob, hire } from "@/lib/abroad";
import { markDelivered, paySecondHalf, release, reportHalfDone } from "@/lib/escrow";
import { rateBooking } from "@/lib/wallet";
import { ensureDemoVerifications } from "@/lib/verification";

/** Fixed ids, so the demo guide can link to the jobs and seeding can tell what already exists. */
export const DEMO_JOBS = {
  villa: "a0000000-0000-4000-8000-000000000001",
  electrician: "a0000000-0000-4000-8000-000000000002",
  driver: "a0000000-0000-4000-8000-000000000003",
  cleaning: "a0000000-0000-4000-8000-000000000004",
  catering: "a0000000-0000-4000-8000-000000000005",
  garden: "a0000000-0000-4000-8000-000000000006",
  painting: "a0000000-0000-4000-8000-000000000007",
} as const;

type Worker = "hari" | "gita" | "ramesh";
interface Spec {
  id: string;
  owner: "suman" | "mina";
  daysAgo: number;
  job: Omit<
    AbroadJob,
    "id" | "clientId" | "clientName" | "isDemo" | "applications" | "createdAt" | "updatedAt"
  >;
  /** pending: applied · held: hired, 50% paid · delivered: both halves paid, work done · released: paid out and rated */
  people: [Worker, "pending" | "held" | "delivered" | "released", string][];
}

const SPECS: Spec[] = [
  {
    id: DEMO_JOBS.catering,
    owner: "suman",
    daysAgo: 40,
    job: {
      title: "Catering helpers for a Dashain event",
      titleNe: "दशैं कार्यक्रमका क्याटरिङ सहयोगी",
      details: "Cooking prep, serving and cleaning up for 200 guests. Food provided.",
      detailsNe: "२०० पाहुनाका लागि तयारी, पस्कने र सफा गर्ने। खाना दिइन्छ।",
      category: "catering",
      country: "Qatar",
      city: "Al Wakrah",
      workersNeeded: 2,
      days: 3,
      payPerWorker: 18_000,
    },
    people: [
      ["hari", "released", "I have done hotel catering in Doha for two years."],
      ["ramesh", "released", "I can help with setup and serving."],
    ],
  },
  {
    id: DEMO_JOBS.cleaning,
    owner: "suman",
    daysAgo: 12,
    job: {
      title: "Deep cleaning of a new office",
      titleNe: "नयाँ कार्यालयको पूर्ण सफाइ",
      details: "Floors, glass and washrooms before opening. Materials provided.",
      detailsNe: "खुल्नुअघि भुइँ, सिसा र शौचालय सफा गर्ने। सामान दिइन्छ।",
      category: "cleaning",
      country: "Qatar",
      city: "Lusail",
      workersNeeded: 2,
      days: 7,
      payPerWorker: 26_000,
    },
    people: [
      ["gita", "delivered", "I do office cleaning and can start at once."],
      ["ramesh", "delivered", "Free on weekdays and weekends."],
    ],
  },
  {
    id: DEMO_JOBS.villa,
    owner: "suman",
    daysAgo: 3,
    job: {
      title: "Helpers for villa renovation",
      titleNe: "भिल्ला मर्मतका सहयोगी",
      details: "Tile removal, carrying and site clean-up. 8 hours a day, lunch and transport provided.",
      detailsNe: "टायल निकाल्ने, सामान बोक्ने र सफा गर्ने। दिनमा ८ घण्टा, खाजा र यातायात दिइन्छ।",
      category: "construction",
      country: "Qatar",
      city: "Doha",
      workersNeeded: 3,
      days: 30,
      payPerWorker: 75_000,
    },
    people: [
      ["gita", "held", "I have worked on two renovation sites here."],
      ["hari", "pending", "Three years of site work in Doha."],
      ["ramesh", "pending", "I can do tiling and carrying."],
    ],
  },
  {
    id: DEMO_JOBS.electrician,
    owner: "suman",
    daysAgo: 2,
    job: {
      title: "Electrician for shop fit-out",
      titleNe: "पसल सजावटका लागि बिजुली मिस्त्री",
      details: "Lights, sockets and a distribution board for one shop.",
      detailsNe: "एउटा पसलको बत्ती, सकेट र वितरण बोर्ड।",
      category: "electrician",
      country: "Qatar",
      city: "Al Sadd",
      workersNeeded: 1,
      days: 10,
      payPerWorker: 48_000,
    },
    people: [["hari", "pending", "I hold a local electrician card and have my own tools."]],
  },
  {
    id: DEMO_JOBS.driver,
    owner: "suman",
    daysAgo: 1,
    job: {
      title: "Delivery driver with Qatar licence",
      titleNe: "कतारको लाइसेन्स भएका डेलिभरी चालक",
      details: "Deliveries inside Doha. Van and fuel provided.",
      detailsNe: "दोहाभित्र डेलिभरी। भ्यान र इन्धन दिइन्छ।",
      category: "driving",
      country: "Qatar",
      city: "Doha",
      workersNeeded: 2,
      days: 30,
      payPerWorker: 90_000,
    },
    people: [],
  },
  {
    id: DEMO_JOBS.garden,
    owner: "mina",
    daysAgo: 5,
    job: {
      title: "Garden workers for a farm house",
      titleNe: "फार्म हाउसका बगैंचा कामदार",
      details: "Planting and watering. Room on site.",
      detailsNe: "बिरुवा रोप्ने र पानी हाल्ने। बस्ने कोठा छ।",
      category: "gardening",
      country: "Malaysia",
      city: "Kuala Lumpur",
      workersNeeded: 4,
      days: 45,
      payPerWorker: 70_000,
    },
    people: [],
  },
  {
    id: DEMO_JOBS.painting,
    owner: "mina",
    daysAgo: 4,
    job: {
      title: "Painters for two townhouses",
      titleNe: "दुई घरका लागि रङ लगाउने कामदार",
      details: "Inside painting. Paint and brushes provided.",
      detailsNe: "भित्री रङरोगन। रङ र ब्रस दिइन्छ।",
      category: "painting",
      country: "Australia",
      city: "Sydney",
      workersNeeded: 2,
      days: 14,
      payPerWorker: 160_000,
    },
    people: [],
  },
];

async function people() {
  let seed: Awaited<ReturnType<typeof demoSeed>> | null = null;
  const out = {} as Record<"suman" | "mina" | Worker, User>;
  for (const key of ["suman", "mina", "hari", "gita", "ramesh"] as const satisfies readonly DemoPersona[]) {
    const { phone } = DEMO_PERSONAS[key];
    let user = await store.getUserByPhone(phone);
    if (!user) {
      seed ??= await demoSeed();
      user = await store.createUser(seed.find((s) => s.phone === phone)!);
    }
    if (!user.isDemo) return null; // a real account has this number: leave it alone
    await ensureDemoVerifications(user);
    out[key] = (await store.getUserById(user.id))!;
  }
  return out;
}

async function seedJob(spec: Spec, who: Record<"suman" | "mina" | Worker, User>) {
  const owner = who[spec.owner];
  const at = new Date(Date.now() - spec.daysAgo * 86_400_000).toISOString();
  let job = await store.putAbroadJob({
    ...spec.job,
    id: spec.id,
    clientId: owner.id,
    clientName: owner.name,
    isDemo: true,
    applications: [],
    createdAt: at,
    updatedAt: at,
  });
  // Through the real rules, so receipts, wallets and notifications are all there.
  const applications: string[] = [];
  for (const [key, , note] of spec.people) {
    const r = await applyToJob(job, who[key], note, true);
    job = r.job;
    applications.push(r.application.id);
  }
  const hires: { key: Worker; step: string; bookingId: string }[] = [];
  for (const [i, [key, step]] of spec.people.entries()) {
    if (step === "pending") continue;
    const r = await hire(job, owner, applications[i]);
    job = r.job;
    hires.push({ key, step, bookingId: r.booking.id });
  }
  for (const { key, step, bookingId } of hires) {
    if (step === "held") continue;
    let booking = (await store.getBooking(bookingId))!;
    booking = await reportHalfDone(booking, who[key]);
    booking = await paySecondHalf(booking, owner);
    const finish = booking.installments.find((i) => i.label === "finish")!.id;
    booking = await markDelivered(booking, who[key], finish);
    if (step !== "released") continue;
    booking = await release(booking, owner, finish);
    await rateBooking(owner, booking, 5, "Reliable, on time and careful work.");
  }
}

/** DEMO_MODE only: the example jobs abroad, created once and again after an admin demo reset. */
export async function ensureAbroadDemo() {
  if (!config.demoMode) return;
  await withLock("seed:abroad", async () => {
    try {
      const existing = new Set((await store.listAbroadJobs()).map((j) => j.id));
      const todo = SPECS.filter((s) => !existing.has(s.id));
      if (!todo.length) return;
      const who = await people();
      if (!who) return;
      for (const spec of todo) await seedJob(spec, who);
    } catch (e) {
      // Example data must never stop anyone signing in.
      console.error("[saksham] Couldn't create the abroad demo.", e);
    }
  });
}
