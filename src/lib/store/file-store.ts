import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Bid, Block, Booking, Conversation, CreditApplication, Dispute, Message, Notification, OtpRecord, Payout, PriceOverride, Question, Rating, Receipt, Report, Store, Task, User, Verification } from "./types";

/**
 * Development store: a single JSON file in .data/ (git-ignored).
 * Good for local work and review. It does NOT persist on serverless hosts —
 * set the Supabase variables for any deployed environment.
 */
interface DB {
  users: User[];
  otps: OtpRecord[];
  verifications?: Verification[];
  tasks?: Task[];
  bids?: Bid[];
  questions?: Question[];
  bookings?: Booking[];
  receipts?: Receipt[];
  disputes?: Dispute[];
  conversations?: Conversation[];
  messages?: Message[];
  notifications?: Notification[];
  payouts?: Payout[];
  ratings?: Rating[];
  creditApplications?: CreditApplication[];
  reports?: Report[];
  blocks?: Block[];
  priceOverrides?: (PriceOverride & { id: string })[];
}

const FILE = path.join(process.cwd(), ".data", "db.json");
/** Private uploads: outside /public, so they are never served statically. */
const PRIVATE_DIR = path.join(process.cwd(), ".data", "private");
const safePath = (p: string) => {
  const full = path.resolve(PRIVATE_DIR, p);
  if (!full.startsWith(PRIVATE_DIR + path.sep)) throw new Error("bad_path");
  return full;
};
/**
 * One shared in-memory copy for the whole server process. In dev, each route can load its own copy of this
 * module, so the cache and the write queue live on globalThis — otherwise one route could miss (or overwrite)
 * another route's changes.
 */
const shared = globalThis as unknown as { __sakshamFileDb?: { cache: DB | null; writing: Promise<void> } };
const state = (shared.__sakshamFileDb ??= { cache: null, writing: Promise.resolve() });

async function load(): Promise<DB> {
  if (state.cache) return state.cache;
  try {
    state.cache = JSON.parse(await fs.readFile(FILE, "utf8")) as DB;
  } catch {
    state.cache = { users: [], otps: [] };
  }
  return state.cache;
}

function persist(db: DB): Promise<void> {
  // Serialise writes so concurrent requests can't interleave partial files.
  state.writing = state.writing.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await fs.rename(tmp, FILE);
  });
  return state.writing;
}

const now = () => new Date().toISOString();

/** Insert-or-replace by id in an optional array on the DB. */
function upsert<T extends { id: string }>(list: T[] | undefined, item: T): T[] {
  const arr = (list ?? []).filter((x) => x.id !== item.id);
  arr.push(item);
  return arr;
}

export const fileStore: Store = {
  async listReports() {
    return (await load()).reports ?? [];
  },
  async putReport(r) {
    const db = await load();
    db.reports = upsert(db.reports, r);
    await persist(db);
    return r;
  },
  async listBlocks(userId) {
    return ((await load()).blocks ?? []).filter((b) => b.blockerId === userId || b.blockedId === userId);
  },
  async putBlock(b) {
    const db = await load();
    db.blocks = (db.blocks ?? []).filter((x) => !(x.blockerId === b.blockerId && x.blockedId === b.blockedId));
    db.blocks.push(b);
    await persist(db);
    return b;
  },
  async deleteBlock(blockerId, blockedId) {
    const db = await load();
    db.blocks = (db.blocks ?? []).filter((x) => !(x.blockerId === blockerId && x.blockedId === blockedId));
    await persist(db);
  },
  async listPriceOverrides() {
    return ((await load()).priceOverrides ?? []).map(({ id: _id, ...p }) => p);
  },
  async putPriceOverride(p) {
    const db = await load();
    db.priceOverrides = upsert(db.priceOverrides, { ...p, id: p.category });
    await persist(db);
    return p;
  },
  async purgeDemoData(demoIds) {
    const db = await load();
    const demo = new Set(demoIds);
    const tasks = new Set((db.tasks ?? []).filter((t) => t.isExample || (t.clientId && demo.has(t.clientId))).map((t) => t.id));
    for (const b of db.bids ?? []) if (demo.has(b.providerId)) tasks.add(b.taskId); // tasks a demo provider bid on stay only if real client
    const realClientTask = (id: string) => (db.tasks ?? []).some((t) => t.id === id && t.clientId && !demo.has(t.clientId) && !t.isExample);
    const dropTask = (id: string) => tasks.has(id) && !realClientTask(id);
    const bookings = new Set((db.bookings ?? []).filter((b) => dropTask(b.taskId) || demo.has(b.clientId) || demo.has(b.providerId)).map((b) => b.id));
    const convs = new Set((db.conversations ?? []).filter((c) => demo.has(c.clientId) || demo.has(c.providerId)).map((c) => c.id));
    db.tasks = (db.tasks ?? []).filter((t) => !dropTask(t.id));
    db.bids = (db.bids ?? []).filter((b) => !dropTask(b.taskId) && !demo.has(b.providerId));
    db.questions = (db.questions ?? []).filter((q) => !dropTask(q.taskId) && !demo.has(q.askerId));
    db.bookings = (db.bookings ?? []).filter((b) => !bookings.has(b.id));
    db.receipts = (db.receipts ?? []).filter((r) => !bookings.has(r.bookingId));
    db.disputes = (db.disputes ?? []).filter((d) => !bookings.has(d.bookingId));
    db.conversations = (db.conversations ?? []).filter((c) => !convs.has(c.id));
    db.messages = (db.messages ?? []).filter((m) => !convs.has(m.conversationId));
    db.notifications = (db.notifications ?? []).filter((n) => !demo.has(n.userId));
    db.payouts = (db.payouts ?? []).filter((p) => !demo.has(p.userId));
    db.ratings = (db.ratings ?? []).filter((r) => !bookings.has(r.bookingId));
    db.creditApplications = (db.creditApplications ?? []).filter((a) => !demo.has(a.userId));
    db.reports = (db.reports ?? []).filter((r) => !demo.has(r.reporterId));
    db.blocks = (db.blocks ?? []).filter((b) => !demo.has(b.blockerId) && !demo.has(b.blockedId));
    db.verifications = (db.verifications ?? []).filter((v) => !demo.has(v.userId));
    await persist(db);
    // Uploaded demo files (ID photos, chat media, task photos)
    for (const id of demoIds) await fs.rm(safePath(id), { recursive: true, force: true }).catch(() => undefined);
    for (const t of tasks) await fs.rm(safePath(`tasks/${t}`), { recursive: true, force: true }).catch(() => undefined);
    for (const c of convs) await fs.rm(safePath(`chat/${c}`), { recursive: true, force: true }).catch(() => undefined);
  },
  async listPayouts(userId) {
    return ((await load()).payouts ?? []).filter((p) => p.userId === userId);
  },
  async putPayout(p) {
    const db = await load();
    db.payouts = upsert(db.payouts, p);
    await persist(db);
    return p;
  },
  async listRatingsFor(rateeId) {
    return ((await load()).ratings ?? []).filter((r) => r.rateeId === rateeId);
  },
  async getRatingByBooking(bookingId) {
    return ((await load()).ratings ?? []).find((r) => r.bookingId === bookingId) ?? null;
  },
  async putRating(r) {
    const db = await load();
    db.ratings = upsert(db.ratings, r);
    await persist(db);
    return r;
  },
  async listCreditApplications(userId) {
    return ((await load()).creditApplications ?? []).filter((a) => a.userId === userId);
  },
  async putCreditApplication(a) {
    const db = await load();
    db.creditApplications = upsert(db.creditApplications, a);
    await persist(db);
    return a;
  },
  async listConversations(userId) {
    return ((await load()).conversations ?? []).filter((c) => c.clientId === userId || c.providerId === userId);
  },
  async getConversation(id) {
    return ((await load()).conversations ?? []).find((c) => c.id === id) ?? null;
  },
  async findConversation(clientId, providerId, taskId) {
    return ((await load()).conversations ?? []).find((c) => c.clientId === clientId && c.providerId === providerId && c.taskId === taskId) ?? null;
  },
  async putConversation(c) {
    const db = await load();
    db.conversations = upsert(db.conversations, c);
    await persist(db);
    return c;
  },
  async listMessages(conversationId) {
    return ((await load()).messages ?? []).filter((m) => m.conversationId === conversationId);
  },
  async putMessage(m) {
    const db = await load();
    db.messages = upsert(db.messages, m);
    await persist(db);
    return m;
  },
  async listNotifications(userId) {
    return ((await load()).notifications ?? []).filter((n) => n.userId === userId);
  },
  async putNotification(n) {
    const db = await load();
    db.notifications = upsert(db.notifications, n);
    await persist(db);
    return n;
  },
  async getBooking(id) {
    return ((await load()).bookings ?? []).find((b) => b.id === id) ?? null;
  },
  async getBookingByTask(taskId) {
    return ((await load()).bookings ?? []).find((b) => b.taskId === taskId) ?? null;
  },
  async listBookings() {
    return (await load()).bookings ?? [];
  },
  async putBooking(b) {
    const db = await load();
    db.bookings = upsert(db.bookings, b);
    await persist(db);
    return b;
  },
  async listReceipts(bookingId) {
    return ((await load()).receipts ?? []).filter((r) => r.bookingId === bookingId);
  },
  async putReceipt(r) {
    const db = await load();
    db.receipts = upsert(db.receipts, r);
    await persist(db);
    return r;
  },
  async listDisputes(bookingId) {
    return ((await load()).disputes ?? []).filter((d) => d.bookingId === bookingId);
  },
  async putDispute(d) {
    const db = await load();
    db.disputes = upsert(db.disputes, d);
    await persist(db);
    return d;
  },
  async listTasks() {
    return (await load()).tasks ?? [];
  },
  async getTask(id) {
    return ((await load()).tasks ?? []).find((t) => t.id === id) ?? null;
  },
  async putTask(t) {
    const db = await load();
    db.tasks = upsert(db.tasks, t);
    await persist(db);
    return t;
  },
  async listBids(taskId) {
    return ((await load()).bids ?? []).filter((b) => b.taskId === taskId);
  },
  async putBid(b) {
    const db = await load();
    db.bids = upsert(db.bids, b);
    await persist(db);
    return b;
  },
  async listQuestions(taskId) {
    return ((await load()).questions ?? []).filter((q) => q.taskId === taskId);
  },
  async putQuestion(q) {
    const db = await load();
    db.questions = upsert(db.questions, q);
    await persist(db);
    return q;
  },
  async getUserByPhone(phone) {
    if (!phone) return null;
    return (await load()).users.find((u) => u.phone === phone) ?? null;
  },
  async listProviderUsers() {
    return (await load()).users.filter((u) => !u.isDemo && u.roles.includes("provider"));
  },
  async getUserByEmail(email) {
    const e = email.trim().toLowerCase();
    if (!e) return null;
    return (await load()).users.find((u) => u.email === e) ?? null;
  },
  async getUserById(id) {
    return (await load()).users.find((u) => u.id === id) ?? null;
  },
  async getUserByPasskeyId(credentialId) {
    return (await load()).users.find((u) => u.passkeys.some((p) => p.id === credentialId)) ?? null;
  },
  async createUser(input) {
    const db = await load();
    if (input.phone && db.users.some((u) => u.phone === input.phone)) throw new Error("phone_taken");
    if (input.email && db.users.some((u) => u.email === input.email)) throw new Error("email_taken");
    const user: User = { ...input, id: randomUUID(), createdAt: now(), updatedAt: now() };
    db.users.push(user);
    await persist(db);
    return user;
  },
  async updateUser(id, patch) {
    const db = await load();
    const i = db.users.findIndex((u) => u.id === id);
    if (i < 0) throw new Error("not_found");
    db.users[i] = { ...db.users[i], ...patch, updatedAt: now() };
    await persist(db);
    return db.users[i];
  },
  async putOtp(rec) {
    const db = await load();
    db.otps = db.otps.filter((o) => o.key !== rec.key && new Date(o.expiresAt).getTime() > Date.now());
    db.otps.push(rec);
    await persist(db);
  },
  async getOtp(key) {
    return (await load()).otps.find((o) => o.key === key) ?? null;
  },
  async deleteOtp(key) {
    const db = await load();
    db.otps = db.otps.filter((o) => o.key !== key);
    await persist(db);
  },
  async resetDemo(seed) {
    const db = await load();
    const gone = new Set(db.users.filter((u) => u.isDemo || seed.some((s) => s.phone === u.phone)).map((u) => u.id));
    db.users = db.users.filter((u) => !gone.has(u.id));
    db.verifications = (db.verifications ?? []).filter((v) => !gone.has(v.userId));
    for (const s of seed) db.users.push({ ...s, id: randomUUID(), createdAt: now(), updatedAt: now() });
    await persist(db);
  },
  async listVerifications(userId) {
    return ((await load()).verifications ?? []).filter((v) => v.userId === userId);
  },
  async putVerification(v) {
    const db = await load();
    db.verifications = (db.verifications ?? []).filter((x) => !(x.userId === v.userId && x.kind === v.kind));
    db.verifications.push(v);
    await persist(db);
    return v;
  },
  async deleteVerification(userId, kind) {
    const db = await load();
    db.verifications = (db.verifications ?? []).filter((x) => !(x.userId === userId && x.kind === kind));
    await persist(db);
  },
  async listPendingVerifications() {
    return ((await load()).verifications ?? []).filter((v) => v.status === "pending");
  },
  async putFile(p, data) {
    const full = safePath(p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  async getFile(p) {
    try { return await fs.readFile(safePath(p)); } catch { return null; }
  },
  async deleteFile(p) {
    await fs.rm(safePath(p), { force: true });
  },
};
