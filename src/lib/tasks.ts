import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { config } from "@/lib/config";
import { store, canSeeWomenOnly } from "@/lib/store";
import type { Bid, Question, Task, User } from "@/lib/store/types";
import { fairRange, category } from "@/lib/pricing";
import { fairRangeLive } from "@/lib/prices";
import { rankBids, counterWithinTolerance, COUNTER_TOLERANCE, type ReasonCode } from "@/lib/rules";
import { CITY_COORDS, areasFor, haversineKm } from "@/lib/geo";
import { EXAMPLE_TASKS } from "@/lib/seed/tasks";
import { EXAMPLE_PROVIDERS, getProvider, isVerified as exampleVerified, providerCoords } from "@/lib/seed/providers";
import { statusFor } from "@/lib/verification";
import { isBlocked, notify, systemMessage } from "@/lib/chat";

/* ================================================================ helpers */
const now = () => new Date().toISOString();
const round100 = (n: number) => Math.round(n / 100) * 100;
/** Deterministic 0..1 from a string, so example offers are stable for a task. */
const unit = (s: string) => parseInt(createHash("sha256").update(s).digest("hex").slice(0, 8), 16) / 0xffffffff;
const isNepali = (s: string) => /[ऀ-ॿ]/.test(s);

export function taskCoords(t: Pick<Task, "online" | "city" | "area" | "lat" | "lng">): [number, number] | null {
  if (t.online || t.city === "Online") return null;
  if (t.lat !== undefined && t.lng !== undefined) return [t.lat, t.lng];
  const a = t.area ? areasFor(t.city).find((x) => x.name === t.area) : undefined;
  return a ? [a.lat, a.lng] : CITY_COORDS[t.city] ?? null;
}

/** Demo personas map onto their example profiles for rating/jobs (sample stats, labelled Example). */
const PERSONA_PROFILE: Record<string, string> = { "9800000002": "bikash-tamang", "9800000003": "aasha-tailoring-group" };

/* ================================================================ seed */
let seeded = false;
/** After an admin demo reset, let the example tasks be seeded again. */
export const resetExampleSeed = () => { seeded = false; };
/** In DEMO_MODE, example tasks (with already-arrived example offers) live in the store like real ones. */
export async function ensureExampleTasks() {
  if (seeded || !config.demoMode) return;
  const existing = new Set((await store.listTasks()).map((t) => t.id));
  for (const ex of EXAMPLE_TASKS) {
    if (existing.has(ex.id)) continue;
    const created = new Date(Date.now() - ex.postedMinutesAgo * 60_000).toISOString();
    const online = ex.city === "Online";
    const r = fairRange({ category: ex.category, days: ex.days, quantity: ex.quantity, city: ex.city, online });
    const c = online ? null : CITY_COORDS[ex.city];
    const task: Task = {
      id: ex.id, clientId: null, clientName: "Example client", isExample: true, category: ex.category,
      title: ex.title.en, titleNe: ex.title.ne, details: ex.title.en, quantity: ex.quantity ?? 1, days: ex.days,
      city: ex.city, area: ex.area, lat: c ? c[0] + (ex.offset?.[0] ?? 0) : undefined, lng: c ? c[1] + (ex.offset?.[1] ?? 0) : undefined,
      online, womenOnly: !!ex.womenOnly, budget: null, fairLow: r.low, fairHigh: r.high, flexible: true,
      forFamilyAbroad: ex.forFamilyAbroad ? { country: ex.forFamilyAbroad, familyName: "" } : undefined,
      photos: [], aiSource: "manual", status: "open", createdAt: created, updatedAt: created,
    };
    await store.putTask(task);
    for (const b of exampleOffers(task, ex.offers, 0)) await store.putBid({ ...b, appearAt: created });
  }
  seeded = true;
}

/* ================================================================ example offers */
const MESSAGES = {
  en: [
    "Hello! I can do this {days}. I've done similar jobs nearby and will send photos when finished.",
    "Namaste. Happy to help — price includes my travel. I can start {days}.",
    "I have the tools and time. Can finish {days}. Ask me anything before you decide.",
    "Done many of these. Fair price, careful work, and I'll keep you updated.",
  ],
  ne: [
    "नमस्ते! म यो काम {days} गर्न सक्छु। नजिकै यस्तै काम गरेको छु, सकेपछि फोटो पठाउँछु।",
    "नमस्ते। सहयोग गर्न खुसी छु — मूल्यमा आउजाउ खर्च पनि छ। {days} सुरु गर्न सक्छु।",
    "औजार र समय दुवै छ। {days} सक्न सक्छु। निर्णय गर्नुअघि जे पनि सोध्नुहोस्।",
    "यस्ता धेरै काम गरेको छु। उचित मूल्य, होसियार काम, र खबर गरिरहन्छु।",
  ],
};

/** Up to `count` offers from example providers. Demo only; every one is labelled "Example offer". */
function exampleOffers(task: Task, count: number, firstDelaySec: number): Bid[] {
  const coords = taskCoords(task);
  const ne = isNepali(task.title);
  const pool = EXAMPLE_PROVIDERS
    // Only providers who actually do this kind of work; demo personas (Bikash, Aasha) bid for real instead.
    .filter((p) => !p.demoPersona && p.categories.includes(task.category as never))
    .filter((p) => !task.womenOnly || p.womenLed)
    .map((p) => ({ p, km: coords ? haversineKm(coords, providerCoords(p)) : p.onlineOk ? 0 : 999 }))
    // In-person work: within ~60 km, or anywhere if the provider also works online and the task is online.
    // Work that can be done online (websites, coding, design) can come from providers anywhere who work online.
    .filter((x) => (coords ? x.km <= 60 || x.p.onlineOk && (task.online || category(task.category).online) : x.p.onlineOk))
    .sort((a, b) => a.km - b.km)
    .slice(0, Math.max(0, count));
  const delays = [firstDelaySec, firstDelaySec + 25, firstDelaySec + 70, firstDelaySec + 140];
  return pool.map(({ p }, i) => {
    const f = 0.12 + unit(`${task.id}:${p.id}`) * 0.85; // where in the fair range this provider bids
    // inDrive-style: when the client set a price, the first provider accepts it and the others raise it a little.
    const raise = [0, 0.05, 0.1, 0.15][i] ?? 0.1;
    const amount = task.budget !== null
      ? Math.max(100, i === 0 ? task.budget : Math.round((task.budget * (1 + raise)) / 50) * 50)
      : Math.max(100, round100(task.fairLow + (task.fairHigh - task.fairLow) * f));
    const days = Math.max(1, task.days + (unit(`${p.id}:${task.id}:d`) > 0.6 ? 1 : 0));
    const whenEn = days === 1 ? "today or tomorrow" : `within ${days} days`;
    const whenNe = days === 1 ? "आज वा भोलि" : `${days} दिनभित्र`;
    const msg = (ne ? MESSAGES.ne : MESSAGES.en)[i % 4].replace("{days}", ne ? whenNe : whenEn);
    const at = new Date(Date.now() + (delays[i] ?? 200) * 1000).toISOString();
    return {
      id: randomUUID(), taskId: task.id, providerId: `ex:${p.id}`, providerName: p.name, isExample: true,
      amount, days, message: msg, status: "active", appearAt: at, createdAt: at, updatedAt: at,
    } satisfies Bid;
  });
}

/* ================================================================ create */
export interface NewTask {
  category: string; title: string; details: string; quantity: number; days: number;
  city: string; area?: string; online: boolean; womenOnly: boolean; budget: number | null;
  dueDate?: string; flexible: boolean; forFamilyAbroad?: { country: string; familyName: string };
  aiSource: Task["aiSource"];
}

export async function createTask(user: User, input: NewTask): Promise<Task> {
  const online = input.online || input.city === "Online";
  const r = await fairRangeLive({ category: input.category, days: input.days, quantity: input.quantity, city: input.city, online });
  const a = !online && input.area ? areasFor(input.city).find((x) => x.name === input.area) : undefined;
  const c = online ? null : a ? [a.lat, a.lng] : CITY_COORDS[input.city];
  const t: Task = {
    id: randomUUID(), clientId: user.id, clientName: user.name, isExample: false,
    category: input.category, title: input.title, details: input.details, quantity: input.quantity, days: input.days,
    city: online ? "Online" : input.city, area: online ? undefined : a?.name, lat: c?.[0], lng: c?.[1], online,
    womenOnly: input.womenOnly, budget: input.budget, fairLow: r.low, fairHigh: r.high, dueDate: input.dueDate,
    flexible: input.flexible, forFamilyAbroad: input.forFamilyAbroad, photos: [], aiSource: input.aiSource,
    status: "open", createdAt: now(), updatedAt: now(),
  };
  await store.putTask(t);
  // Example offers only for the demo accounts; a real task waits for real offers.
  if (config.demoMode && user.isDemo) for (const b of exampleOffers(t, 4, 15)) await store.putBid(b);
  // Like a ride request: real providers with this skill (same city, or any city for online work) hear about it.
  if (!user.isDemo) {
    const pros = (await store.listProviderUsers()).filter((p) => p.id !== user.id && (p.categories ?? []).includes(t.category) && (t.online || p.city === t.city));
    for (const p of pros.slice(0, 50)) await notify(p.id, "bid", "task_new", { task: t.title, amount: t.budget ?? 0 }, `/task/${t.id}`);
  }
  return t;
}

/* ================================================================ visibility */
/**
 * Real accounts use a real marketplace: they never see example tasks or anything the demo accounts post,
 * and the demo accounts only see the examples and each other. Pass a cache when checking many tasks.
 */
export async function sameWorld(task: Task, viewer: User, cache = new Map<string, boolean>()): Promise<boolean> {
  if (task.isExample) return viewer.isDemo;
  if (!task.clientId || task.clientId === viewer.id) return true;
  let demo = cache.get(task.clientId);
  if (demo === undefined) {
    demo = !!(await store.getUserById(task.clientId))?.isDemo;
    cache.set(task.clientId, demo);
  }
  return demo === viewer.isDemo;
}

export async function canView(task: Task, viewer: User): Promise<boolean> {
  if (task.clientId === viewer.id) return true;
  if (!(await sameWorld(task, viewer))) return false;
  return !task.womenOnly || canSeeWomenOnly(viewer);
}

export const isOwner = (task: Task, viewer: User) => task.clientId === viewer.id;

/* ================================================================ ranked offers */
export interface OfferView {
  id: string;
  providerId: string;
  providerName: string;
  profileHref: string | null;
  isExample: boolean;
  amount: number;
  days: number;
  message: string;
  status: Bid["status"];
  counter?: Bid["counter"];
  rating: number;
  ratingCount: number;
  jobs: number;
  verified: boolean;
  womenLed: boolean;
  distanceKm: number | null;
  score: number;
  reasons: ReasonCode[];
  best: boolean;
  mine: boolean;
  createdAt: string;
}

async function statsFor(b: Bid) {
  if (b.isExample) {
    const p = getProvider(b.providerId.slice(3));
    return p
      ? { rating: p.rating, ratingCount: p.ratingCount, jobs: p.jobsDone, verified: exampleVerified(p), womenLed: p.womenLed, coords: providerCoords(p) as [number, number] | null, href: `/profile/${p.id}` }
      : null;
  }
  const u = await store.getUserById(b.providerId);
  if (!u) return null;
  const persona = u.isDemo ? getProvider(PERSONA_PROFILE[u.phone] ?? "") : null;
  // Real accounts: their own ratings and their real profile page.
  const ratings = persona ? [] : await store.listRatingsFor(u.id);
  const avg = ratings.length ? Math.round((ratings.reduce((a, r) => a + r.stars, 0) / ratings.length) * 10) / 10 : 0;
  return {
    rating: persona?.rating ?? avg, ratingCount: persona?.ratingCount ?? ratings.length, jobs: persona?.jobsDone ?? ratings.length,
    verified: !!u.verified, womenLed: !!u.womenLed,
    coords: (u.lat !== undefined && u.lng !== undefined ? [u.lat, u.lng] : CITY_COORDS[u.city] ?? null) as [number, number] | null,
    href: persona ? `/profile/${persona.id}` : !u.isDemo && u.roles.includes("provider") ? `/profile/${u.id}` : null,
  };
}

/** Visible offers, ranked by best value (plain code: 0.35 price + 0.30 rating + 0.20 distance + 0.15 verified). */
export async function rankedOffers(task: Task, viewer: User): Promise<OfferView[]> {
  const t = Date.now();
  const bids = (await store.listBids(task.id)).filter((b) => new Date(b.appearAt).getTime() <= t && b.status !== "withdrawn");
  const coords = taskCoords(task);
  const enriched = (await Promise.all(bids.map(async (b) => {
    const s = await statsFor(b);
    if (!s) return null;
    const distanceKm = coords && s.coords ? Math.round(haversineKm(coords, s.coords) * 10) / 10 : null;
    return { b, s, amount: b.counter?.status === "accepted" ? b.counter.amount : b.amount, rating: s.rating, distanceKm, verified: s.verified, jobs: s.jobs };
  }))).filter((x): x is NonNullable<typeof x> => x !== null);

  const mid = round100((task.fairLow + task.fairHigh) / 2);
  const ranked = rankBids(enriched, { low: task.fairLow, high: task.fairHigh, mid });
  const owner = isOwner(task, viewer);
  return ranked.map((r, i) => ({
    id: r.bid.b.id,
    providerId: r.bid.b.providerId,
    providerName: r.bid.b.providerName,
    profileHref: r.bid.s.href,
    isExample: r.bid.b.isExample,
    amount: r.bid.amount,
    days: r.bid.b.days,
    // Offer messages are visible to the client and to the provider who wrote them; others see price and stats only.
    message: owner || r.bid.b.providerId === viewer.id ? r.bid.b.message : "",
    status: r.bid.b.status,
    counter: owner || r.bid.b.providerId === viewer.id ? r.bid.b.counter : undefined,
    rating: r.bid.s.rating,
    ratingCount: r.bid.s.ratingCount,
    jobs: r.bid.s.jobs,
    verified: r.bid.s.verified,
    womenLed: r.bid.s.womenLed,
    distanceKm: r.bid.distanceKm,
    score: r.score,
    reasons: r.reasons,
    best: i === 0 && r.bid.b.status === "active",
    mine: r.bid.b.providerId === viewer.id,
    createdAt: r.bid.b.appearAt,
  }));
}

/* ================================================================ actions */
export class RuleError extends Error {
  constructor(public code: string, public status = 409, public extra: Record<string, unknown> = {}) { super(code); }
}

/** A provider makes (or updates) an offer. Requires a verified ID, per the Verification center unlocks. */
export async function placeBid(task: Task, user: User, input: { amount: number; days: number; message: string }) {
  if (!user.roles.includes("provider")) throw new RuleError("provider_only", 403);
  if (isOwner(task, user)) throw new RuleError("own_task", 403);
  if (!(await canView(task, user))) throw new RuleError("not_found", 404);
  if (task.status !== "open") throw new RuleError("task_closed");
  const kyc = await statusFor(user);
  if (kyc.id.status !== "verified" || kyc.selfie.status !== "verified") throw new RuleError("id_required", 403);
  if (task.clientId && (await isBlocked(task.clientId, user.id))) throw new RuleError("not_found", 404);
  if (input.amount < 100 || input.amount > task.fairHigh * 10) throw new RuleError("amount_range", 422, { field: "amount" });

  const mine = (await store.listBids(task.id)).find((b) => b.providerId === user.id && b.status !== "withdrawn");
  if (mine?.counter?.status === "pending") throw new RuleError("counter_pending");
  const b: Bid = {
    id: mine?.id ?? randomUUID(), taskId: task.id, providerId: user.id, providerName: user.name, isExample: false,
    amount: Math.round(input.amount), days: input.days, message: input.message, status: "active",
    counter: undefined, appearAt: mine?.appearAt ?? now(), createdAt: mine?.createdAt ?? now(), updatedAt: now(),
  };
  const saved = await store.putBid(b);
  const code = mine ? "bid_updated" : "bid_new";
  await notify(task.clientId, "bid", code, { provider: user.name, amount: b.amount, task: task.title }, `/task/${task.id}`);
  await systemMessage(task.clientId, user.id, task.id, code, { amount: b.amount, days: b.days, provider: user.name });
  return saved;
}

export async function withdrawBid(task: Task, user: User, bidId: string) {
  const b = (await store.listBids(task.id)).find((x) => x.id === bidId);
  if (!b || b.providerId !== user.id) throw new RuleError("not_found", 404);
  if (b.status !== "active") throw new RuleError("bid_closed");
  return store.putBid({ ...b, status: "withdrawn", updatedAt: now() });
}

/**
 * Client counters an offer. Within ~7% of the bid it is accepted automatically (rule from the brief).
 * Real providers answer larger counters themselves; example providers decline them (demo).
 */
export async function counterBid(task: Task, user: User, bidId: string, amount: number) {
  if (!isOwner(task, user)) throw new RuleError("forbidden", 403);
  if (task.status !== "open") throw new RuleError("task_closed");
  const b = (await store.listBids(task.id)).find((x) => x.id === bidId);
  if (!b || b.status !== "active") throw new RuleError("bid_closed");
  if (b.counter?.status === "pending") throw new RuleError("counter_pending");
  if (amount >= b.amount) throw new RuleError("counter_not_lower", 422, { field: "amount" });
  if (amount < b.amount * 0.5) throw new RuleError("counter_too_low", 422, { field: "amount" });
  const auto = counterWithinTolerance(b.amount, amount);
  const status = auto ? "accepted" : b.isExample ? "declined" : "pending";
  const updated: Bid = { ...b, counter: { amount: Math.round(amount), status, at: now(), by: "client" }, updatedAt: now() };
  await store.putBid(updated);
  const code = auto ? "counter_auto" : "counter_new";
  await notify(b.providerId, "counter", code, { amount: Math.round(amount), task: task.title }, `/task/${task.id}`);
  await systemMessage(task.clientId, b.providerId, task.id, code, { amount: Math.round(amount) });
  return { bid: updated, auto, tolerance: COUNTER_TOLERANCE };
}

/** The provider who made the bid accepts or declines a pending counter. */
export async function respondCounter(task: Task, user: User, bidId: string, accept: boolean) {
  const b = (await store.listBids(task.id)).find((x) => x.id === bidId);
  if (!b || b.providerId !== user.id) throw new RuleError("not_found", 404);
  if (b.counter?.status !== "pending") throw new RuleError("no_counter");
  const updated: Bid = { ...b, counter: { ...b.counter, status: accept ? "accepted" : "declined" }, updatedAt: now() };
  await store.putBid(updated);
  const code = accept ? "counter_accepted" : "counter_declined";
  await notify(task.clientId, "counter", code, { provider: user.name, amount: b.counter.amount }, `/task/${task.id}`);
  await systemMessage(task.clientId, b.providerId, task.id, code, { amount: b.counter.amount });
  return updated;
}

/** Client accepts an offer. The price locks (counter price if one was accepted); other offers close. */
export async function acceptBid(task: Task, user: User, bidId: string) {
  if (!isOwner(task, user)) throw new RuleError("forbidden", 403);
  if (task.status !== "open") throw new RuleError("task_closed");
  // Clients finish KYC (ID card + selfie) before they hire.
  const kyc = await statusFor(user);
  if (kyc.id.status !== "verified" || kyc.selfie.status !== "verified") throw new RuleError("kyc_required", 403);
  const bids = await store.listBids(task.id);
  const b = bids.find((x) => x.id === bidId);
  if (!b || b.status !== "active" || new Date(b.appearAt).getTime() > Date.now()) throw new RuleError("bid_closed");
  const price = b.counter?.status === "accepted" ? b.counter.amount : b.amount;
  for (const other of bids) {
    if (other.id === b.id) await store.putBid({ ...other, status: "accepted", updatedAt: now() });
    else if (other.status === "active") {
      await store.putBid({ ...other, status: "declined", updatedAt: now() });
      await notify(other.providerId, "bid", "bid_declined", { task: task.title }, `/task/${task.id}`);
    }
  }
  const t = await store.putTask({ ...task, status: "assigned", acceptedBidId: b.id, agreedPrice: price, updatedAt: now() });
  await notify(b.providerId, "bid", "bid_accepted", { task: task.title, amount: price }, `/task/${task.id}`);
  await systemMessage(task.clientId, b.providerId, task.id, "bid_accepted", { amount: price });
  return t;
}

export async function ask(task: Task, user: User, body: string): Promise<Question> {
  if (!(await canView(task, user))) throw new RuleError("not_found", 404);
  if (isOwner(task, user)) throw new RuleError("own_task", 403);
  const mine = (await store.listQuestions(task.id)).filter((q) => q.askerId === user.id);
  if (mine.length >= 5) throw new RuleError("too_many_questions", 429);
  const q = await store.putQuestion({ id: randomUUID(), taskId: task.id, askerId: user.id, askerName: user.name.split(" ")[0], body, createdAt: now() });
  await notify(task.clientId, "system", "question_new", { from: q.askerName, task: task.title }, `/task/${task.id}`);
  return q;
}

export async function answer(task: Task, user: User, questionId: string, text: string): Promise<Question> {
  if (!isOwner(task, user)) throw new RuleError("forbidden", 403);
  const q = (await store.listQuestions(task.id)).find((x) => x.id === questionId);
  if (!q) throw new RuleError("not_found", 404);
  const saved = await store.putQuestion({ ...q, answer: text, answeredAt: now() });
  await notify(q.askerId, "system", "question_answered", { task: task.title }, `/task/${task.id}`);
  return saved;
}

export const categoryLabel = (id: string, lang: "en" | "ne") => (lang === "ne" ? category(id).ne : category(id).en);
