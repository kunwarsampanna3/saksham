import "server-only";
import { randomUUID } from "node:crypto";
import { store } from "@/lib/store";
import type { Task, User } from "@/lib/store/types";
import { DEMO_PERSONAS, demoSeed, type DemoPersona } from "@/lib/auth/demo";
import { config } from "@/lib/config";
import { withLock } from "@/lib/lock";
import { RuleError } from "@/lib/tasks";
import {
  createBooking,
  markDelivered,
  openDispute,
  paySecondHalf,
  release,
  reportHalfDone,
} from "@/lib/escrow";
import { requestPayout } from "@/lib/wallet";
import { CATEGORIES } from "@/lib/pricing";

/**
 * DEMO_MODE only: sample bookings between demo accounts so the Super Admin dashboard has something to show.
 * They go through the real escrow functions, so every rupee follows the real 50 / 30 / 20 / 40 rules,
 * and they are removed by Admin → "Reset demo" like any other demo data. No real money moves: all sandbox.
 */
export const SAMPLE_PREFIX = "Sample · ";

type Step = "advance" | "half" | "second" | "delivered" | "completed" | "dispute";
interface Spec {
  client: DemoPersona;
  applicant: DemoPersona;
  category: string;
  title: string;
  total: number;
  step: Step;
  daysAgo: number;
}

const SPECS: Spec[] = [
  {
    client: "mina",
    applicant: "aasha",
    category: "tailoring",
    title: "50 school uniforms",
    total: 42_000,
    step: "completed",
    daysAgo: 140,
  },
  {
    client: "mina",
    applicant: "bikash",
    category: "web-design",
    title: "Boutique website",
    total: 24_000,
    step: "completed",
    daysAgo: 105,
  },
  {
    client: "suman",
    applicant: "hari",
    category: "electrician",
    title: "Rewire family house, Pokhara",
    total: 18_500,
    step: "completed",
    daysAgo: 75,
  },
  {
    client: "mina",
    applicant: "bikash",
    category: "phone-repair",
    title: "Repair three shop phones",
    total: 3_500,
    step: "completed",
    daysAgo: 48,
  },
  {
    client: "suman",
    applicant: "gita",
    category: "cleaning",
    title: "Deep clean before Dashain",
    total: 6_000,
    step: "dispute",
    daysAgo: 30,
  },
  {
    client: "mina",
    applicant: "aasha",
    category: "tailoring",
    title: "Festival kurta order",
    total: 15_000,
    step: "delivered",
    daysAgo: 20,
  },
  {
    client: "mina",
    applicant: "bikash",
    category: "web-design",
    title: "Online shop setup",
    total: 30_000,
    step: "second",
    daysAgo: 12,
  },
  {
    client: "suman",
    applicant: "hari",
    category: "electrician",
    title: "Solar inverter install",
    total: 10_000,
    step: "half",
    daysAgo: 6,
  },
  {
    client: "mina",
    applicant: "gita",
    category: "cleaning",
    title: "Shop cleaning, weekly",
    total: 8_000,
    step: "advance",
    daysAgo: 2,
  },
];

async function demoPeople() {
  const keys = [...new Set(SPECS.flatMap((s) => [s.client, s.applicant]))];
  let seed: Awaited<ReturnType<typeof demoSeed>> | null = null;
  const out = {} as Record<DemoPersona, User>;
  for (const key of keys) {
    const { phone } = DEMO_PERSONAS[key];
    let u = await store.getUserByPhone(phone);
    if (!u) {
      seed ??= await demoSeed();
      u = await store.createUser(seed.find((s) => s.phone === phone)!);
    }
    if (!u.isDemo) throw new RuleError("real_account_on_demo_number"); // never touch a real account
    out[key] = u;
  }
  return out;
}

async function one(spec: Spec, who: Record<DemoPersona, User>) {
  const client = who[spec.client];
  const applicant = who[spec.applicant];
  const cat = CATEGORIES.find((c) => c.id === spec.category)!;
  const at = new Date().toISOString();
  const task: Task = {
    id: randomUUID(),
    clientId: client.id,
    clientName: client.name,
    isExample: false,
    category: spec.category,
    title: SAMPLE_PREFIX + spec.title,
    details: "Sample booking for the Super Admin demo. Sandbox money only.",
    quantity: 1,
    days: 10,
    city: client.city,
    online: false,
    womenOnly: false,
    budget: null,
    fairLow: cat.low,
    fairHigh: Math.max(cat.high, spec.total),
    flexible: true,
    photos: [],
    aiSource: "manual",
    status: "assigned",
    acceptedBidId: randomUUID(),
    agreedPrice: spec.total,
    createdAt: at,
    updatedAt: at,
  };
  await store.putBid({
    id: task.acceptedBidId!,
    taskId: task.id,
    providerId: applicant.id,
    providerName: applicant.name,
    isExample: false,
    amount: spec.total,
    days: 10,
    message: "Sample offer",
    status: "accepted",
    appearAt: at,
    createdAt: at,
    updatedAt: at,
  });
  await store.putTask(task);

  let b = await createBooking(task, client, spec.client === "suman" ? "khalti_sandbox" : "esewa_sandbox");
  const finishId = () => b.installments.find((i) => i.label === "finish")!.id;
  const order: Step[] = ["half", "second", "delivered", "completed"];
  if (spec.step === "dispute") {
    await openDispute(b, client, "The work was not finished as agreed.", "refund");
    b = (await store.getBooking(b.id))!;
  } else {
    for (const step of order.slice(0, order.indexOf(spec.step as Step) + 1)) {
      if (step === "half") b = await reportHalfDone(b, applicant);
      if (step === "second") b = await paySecondHalf(b, client);
      if (step === "delivered") b = await markDelivered(b, applicant, finishId());
      if (step === "completed") b = await release(b, client, finishId());
    }
  }

  // Spread the samples over the last few months so the monthly charts have a shape. These records were made a
  // moment ago by this function, as sample data; real records are never re-dated.
  const shift = spec.daysAgo * 86_400_000;
  const back = (iso?: string) => (iso ? new Date(Date.parse(iso) - shift).toISOString() : iso);
  for (const r of await store.listReceipts(b.id))
    await store.putReceipt({ ...r, createdAt: back(r.createdAt)! });
  await store.putBooking({
    ...b,
    createdAt: back(b.createdAt)!,
    halfDoneAt: back(b.halfDoneAt),
    installments: b.installments.map((i) => ({
      ...i,
      heldAt: back(i.heldAt),
      deliveredAt: back(i.deliveredAt),
      releasedAt: back(i.releasedAt),
    })),
  });
  const t = await store.getTask(task.id);
  if (t) await store.putTask({ ...t, createdAt: back(t.createdAt)! });
}

export async function seedFinanceDemo() {
  if (!config.demoMode) throw new RuleError("not_found", 404);
  return withLock("finance:demo-seed", async () => {
    const tasks = await store.listTasks();
    if (tasks.some((t) => t.title.startsWith(SAMPLE_PREFIX))) throw new RuleError("already_seeded");
    const who = await demoPeople();
    for (const spec of SPECS) await one(spec, who);
    // Two withdrawals for the Super Admin to review (or sent at once, if review is off).
    for (const [key, amount] of [
      ["aasha", 20_000],
      ["bikash", 5_000],
      ["hari", 8_000],
    ] as const) {
      const u = (await store.getUserById(who[key].id))!;
      await withLock(`wallet:${u.id}`, () => requestPayout(u, amount, "esewa_sandbox"));
    }
    return SPECS.length;
  });
}
