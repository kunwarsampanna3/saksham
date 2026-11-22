import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";
import type {
  AbroadJob,
  Bid,
  Block,
  Booking,
  Conversation,
  CreditApplication,
  Dispute,
  Installment,
  Message,
  Notification,
  OtpRecord,
  Passkey,
  Payout,
  PriceOverride,
  Question,
  Rating,
  Receipt,
  Report,
  Store,
  StoredFile,
  Task,
  User,
  Verification,
} from "./types";

/**
 * Production store backed by Supabase Postgres (see supabase/migrations).
 * Uses the service-role key on the server only; RLS still protects every table
 * for any client-side (anon key) access.
 */
let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  client ??= createClient(config.supabase.url, config.supabase.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

type Row = {
  id: string;
  phone: string | null;
  email: string | null;
  name: string;
  city: string;
  roles: User["roles"];
  active_role: User["activeRole"];
  mpin_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  lang: User["lang"];
  is_demo: boolean;
  is_admin: boolean;
  headline: string | null;
  gender: User["gender"] | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
  trusted_contacts: { name: string; phone: string }[] | null;
  verified: boolean;
  women_led: boolean;
  created_at: string;
  updated_at: string;
  categories: string[] | null;
  marketing_opt_in: boolean | null;
  terms_accepted_at: string | null;
  session_version: number | null;
  revoked_sessions: User["revokedSessions"] | null;
  passkeys?: {
    credential_id: string;
    public_key: string;
    counter: number;
    transports: string[] | null;
    label: string;
    created_at: string;
  }[];
};

const SELECT = "*, passkeys(credential_id, public_key, counter, transports, label, created_at)";

function toUser(r: Row): User {
  return {
    id: r.id,
    phone: r.phone ?? "",
    email: r.email ?? undefined,
    name: r.name,
    city: r.city,
    roles: r.roles,
    activeRole: r.active_role,
    mpinHash: r.mpin_hash,
    failedAttempts: r.failed_attempts,
    lockedUntil: r.locked_until,
    lang: r.lang,
    isDemo: r.is_demo,
    isAdmin: r.is_admin,
    headline: r.headline ?? undefined,
    gender: r.gender ?? undefined,
    area: r.area ?? undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    radiusKm: r.radius_km ?? undefined,
    trustedContacts: r.trusted_contacts ?? [],
    verified: r.verified,
    womenLed: r.women_led,
    categories: r.categories ?? [],
    marketingOptIn: r.marketing_opt_in ?? false,
    termsAcceptedAt: r.terms_accepted_at ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sessionVersion: r.session_version ?? 0,
    revokedSessions: r.revoked_sessions ?? [],
    passkeys: (r.passkeys ?? []).map<Passkey>((p) => ({
      id: p.credential_id,
      publicKey: p.public_key,
      counter: p.counter,
      transports: p.transports ?? undefined,
      label: p.label,
      createdAt: p.created_at,
    })),
  };
}

function toRow(u: Partial<User>): Partial<Row> {
  const r: Partial<Row> = {};
  if (u.phone !== undefined) r.phone = u.phone || null;
  if (u.email !== undefined) r.email = u.email || null;
  if (u.name !== undefined) r.name = u.name;
  if (u.city !== undefined) r.city = u.city;
  if (u.roles !== undefined) r.roles = u.roles;
  if (u.activeRole !== undefined) r.active_role = u.activeRole;
  if (u.mpinHash !== undefined) r.mpin_hash = u.mpinHash;
  if (u.failedAttempts !== undefined) r.failed_attempts = u.failedAttempts;
  if (u.lockedUntil !== undefined) r.locked_until = u.lockedUntil;
  if (u.lang !== undefined) r.lang = u.lang;
  if (u.isDemo !== undefined) r.is_demo = u.isDemo;
  if (u.isAdmin !== undefined) r.is_admin = u.isAdmin;
  if (u.headline !== undefined) r.headline = u.headline;
  if (u.categories !== undefined) r.categories = u.categories;
  if (u.marketingOptIn !== undefined) r.marketing_opt_in = u.marketingOptIn;
  if (u.termsAcceptedAt !== undefined) r.terms_accepted_at = u.termsAcceptedAt;
  if (u.gender !== undefined) r.gender = u.gender;
  if (u.area !== undefined) r.area = u.area;
  if (u.lat !== undefined) r.lat = u.lat;
  if (u.lng !== undefined) r.lng = u.lng;
  if (u.radiusKm !== undefined) r.radius_km = u.radiusKm;
  if (u.trustedContacts !== undefined) r.trusted_contacts = u.trustedContacts;
  if (u.verified !== undefined) r.verified = u.verified;
  if (u.womenLed !== undefined) r.women_led = u.womenLed;
  if (u.sessionVersion !== undefined) r.session_version = u.sessionVersion;
  if (u.revokedSessions !== undefined) r.revoked_sessions = u.revokedSessions;
  return r;
}

async function one(q: PromiseLike<{ data: Row | null; error: { message: string } | null }>) {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ? toUser(data) : null;
}

async function syncPasskeys(userId: string, passkeys: Passkey[]) {
  const { error: delErr } = await db().from("passkeys").delete().eq("user_id", userId);
  if (delErr) throw new Error(delErr.message);
  if (!passkeys.length) return;
  const { error } = await db()
    .from("passkeys")
    .insert(
      passkeys.map((p) => ({
        user_id: userId,
        credential_id: p.id,
        public_key: p.publicKey,
        counter: p.counter,
        transports: p.transports ?? null,
        label: p.label,
        created_at: p.createdAt,
      })),
    );
  if (error) throw new Error(error.message);
}

type BaseMethods = Omit<
  Store,
  | "listAbroadJobs"
  | "getAbroadJob"
  | "putAbroadJob"
  | "listReports"
  | "putReport"
  | "listBlocks"
  | "putBlock"
  | "deleteBlock"
  | "listPriceOverrides"
  | "putPriceOverride"
  | "purgeDemoData"
  | "listPayouts"
  | "putPayout"
  | "listRatingsFor"
  | "getRatingByBooking"
  | "putRating"
  | "listCreditApplications"
  | "putCreditApplication"
  | "listConversations"
  | "getConversation"
  | "findConversation"
  | "putConversation"
  | "listMessages"
  | "putMessage"
  | "listNotifications"
  | "putNotification"
  | "getBooking"
  | "getBookingByTask"
  | "listBookings"
  | "putBooking"
  | "listReceipts"
  | "putReceipt"
  | "listDisputes"
  | "putDispute"
  | "listTasks"
  | "getTask"
  | "putTask"
  | "listBids"
  | "putBid"
  | "listQuestions"
  | "putQuestion"
  | "listVerifications"
  | "putVerification"
  | "deleteVerification"
  | "listPendingVerifications"
  | "listExpiredVerifications"
  | "putFile"
  | "getFile"
  | "deleteFile"
>;
const base: BaseMethods = {
  getUserByPhone: async (phone) =>
    phone ? one(db().from("users").select(SELECT).eq("phone", phone).maybeSingle()) : null,
  getUserByEmail: async (email) =>
    email
      ? one(db().from("users").select(SELECT).eq("email", email.trim().toLowerCase()).maybeSingle())
      : null,
  async listProviderUsers() {
    const { data, error } = await db()
      .from("users")
      .select(SELECT)
      .contains("roles", ["provider"])
      .eq("is_demo", false)
      .limit(500);
    if (error) throw new Error(error.message);
    return (data as Row[]).map(toUser);
  },
  getUserById: (id) => one(db().from("users").select(SELECT).eq("id", id).maybeSingle()),
  async getUserByPasskeyId(credentialId) {
    const { data, error } = await db()
      .from("passkeys")
      .select("user_id")
      .eq("credential_id", credentialId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? supabaseStore.getUserById(data.user_id as string) : null;
  },
  async createUser(input) {
    const { data, error } = await db().from("users").insert(toRow(input)).select(SELECT).single();
    if (error)
      throw new Error(
        error.code === "23505"
          ? /email/.test(error.message)
            ? "email_taken"
            : "phone_taken"
          : error.message,
      );
    return toUser(data as Row);
  },
  async updateUser(id, patch) {
    const row = toRow(patch);
    if (Object.keys(row).length) {
      const { error } = await db().from("users").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    }
    if (patch.passkeys) await syncPasskeys(id, patch.passkeys);
    const u = await supabaseStore.getUserById(id);
    if (!u) throw new Error("not_found");
    return u;
  },
  async putOtp(rec) {
    const { error } = await db().from("otp_codes").upsert({
      key: rec.key,
      phone: rec.phone,
      purpose: rec.purpose,
      code_hash: rec.codeHash,
      expires_at: rec.expiresAt,
      attempts: rec.attempts,
      last_sent_at: rec.lastSentAt,
    });
    if (error) throw new Error(error.message);
  },
  async getOtp(key) {
    const { data, error } = await db().from("otp_codes").select("*").eq("key", key).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      key: data.key,
      phone: data.phone,
      purpose: data.purpose,
      codeHash: data.code_hash,
      expiresAt: data.expires_at,
      attempts: data.attempts,
      lastSentAt: data.last_sent_at,
    } satisfies OtpRecord;
  },
  async deleteOtp(key) {
    const { error } = await db().from("otp_codes").delete().eq("key", key);
    if (error) throw new Error(error.message);
  },
  async resetDemo(seed) {
    const phones = seed.map((s) => s.phone);
    const { error } = await db()
      .from("users")
      .delete()
      .or(`is_demo.eq.true,phone.in.(${phones.join(",")})`);
    if (error) throw new Error(error.message);
    const { error: insErr } = await db().from("users").insert(seed.map(toRow));
    if (insErr) throw new Error(insErr.message);
  },
};

/* ------------------------------------------------------------ verifications */
type VRow = {
  id: string;
  user_id: string;
  kind: Verification["kind"];
  status: Verification["status"];
  simulated: boolean;
  files: Verification["files"];
  fields: Record<string, string>;
  note: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  reviewer_id: string | null;
  purge_after: string | null;
};
const toV = (r: VRow): Verification => ({
  id: r.id,
  userId: r.user_id,
  kind: r.kind,
  status: r.status,
  simulated: r.simulated,
  files: r.files ?? [],
  fields: r.fields ?? {},
  note: r.note ?? undefined,
  submittedAt: r.submitted_at ?? undefined,
  decidedAt: r.decided_at ?? undefined,
  reviewerId: r.reviewer_id ?? undefined,
  purgeAfter: r.purge_after ?? undefined,
});
const BUCKET = "id-docs";

const verificationMethods = {
  async listVerifications(userId: string) {
    const { data, error } = await db().from("verifications").select("*").eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data as VRow[]).map(toV);
  },
  async putVerification(v: Verification) {
    const { error } = await db()
      .from("verifications")
      .upsert(
        {
          id: v.id,
          user_id: v.userId,
          kind: v.kind,
          status: v.status,
          simulated: v.simulated,
          files: v.files,
          fields: v.fields,
          note: v.note ?? null,
          submitted_at: v.submittedAt ?? null,
          decided_at: v.decidedAt ?? null,
          reviewer_id: v.reviewerId ?? null,
          purge_after: v.purgeAfter ?? null,
        },
        { onConflict: "user_id,kind" },
      );
    if (error) throw new Error(error.message);
    return v;
  },
  async deleteVerification(userId: string, kind: Verification["kind"]) {
    const { error } = await db().from("verifications").delete().eq("user_id", userId).eq("kind", kind);
    if (error) throw new Error(error.message);
  },
  async listPendingVerifications() {
    const { data, error } = await db()
      .from("verifications")
      .select("*")
      .eq("status", "pending")
      .order("submitted_at");
    if (error) throw new Error(error.message);
    return (data as VRow[]).map(toV);
  },
  async putFile(path: string, data: Buffer, mime: string) {
    const { error } = await db().storage.from(BUCKET).upload(path, data, { contentType: mime, upsert: true });
    if (error) throw new Error(error.message);
  },
  async getFile(path: string) {
    const { data, error } = await db().storage.from(BUCKET).download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  },
  async deleteFile(path: string) {
    const { error } = await db().storage.from(BUCKET).remove([path]);
    if (error) throw new Error(error.message); // retention must not record a deletion that didn't happen
  },
  async listExpiredVerifications(before: string) {
    const { data, error } = await db()
      .from("verifications")
      .select("*")
      .lt("purge_after", before)
      .neq("files", "[]");
    if (error) throw new Error(error.message);
    return (data as VRow[]).map(toV);
  },
} satisfies Pick<
  Store,
  | "listVerifications"
  | "putVerification"
  | "deleteVerification"
  | "listPendingVerifications"
  | "listExpiredVerifications"
  | "putFile"
  | "getFile"
  | "deleteFile"
>;

/* ------------------------------------------------------------ tasks, bids, Q&A */
type TRow = {
  id: string;
  client_id: string | null;
  client_name: string;
  is_example: boolean;
  category: string;
  title: string;
  title_ne: string | null;
  details: string;
  quantity: number;
  days: number;
  city: string | null;
  area: string | null;
  lat: number | null;
  lng: number | null;
  online: boolean;
  women_only: boolean;
  budget: number | null;
  fair_low: number;
  fair_high: number;
  due_date: string | null;
  flexible: boolean;
  family_country: string | null;
  family_name: string | null;
  abroad: Task["abroad"] | null;
  photos: StoredFile[];
  ai_source: Task["aiSource"];
  status: Task["status"];
  accepted_bid_id: string | null;
  agreed_price: number | null;
  created_at: string;
  updated_at: string;
};
const toT = (r: TRow): Task => ({
  id: r.id,
  clientId: r.client_id,
  clientName: r.client_name,
  isExample: r.is_example,
  category: r.category,
  title: r.title,
  titleNe: r.title_ne ?? undefined,
  details: r.details,
  quantity: r.quantity,
  days: r.days,
  city: r.city ?? "Online",
  area: r.area ?? undefined,
  lat: r.lat ?? undefined,
  lng: r.lng ?? undefined,
  online: r.online,
  womenOnly: r.women_only,
  budget: r.budget,
  fairLow: r.fair_low,
  fairHigh: r.fair_high,
  dueDate: r.due_date ?? undefined,
  flexible: r.flexible,
  forFamilyAbroad: r.family_country
    ? { country: r.family_country, familyName: r.family_name ?? "" }
    : undefined,
  abroad: r.abroad ?? undefined,
  photos: r.photos ?? [],
  aiSource: r.ai_source,
  status: r.status,
  acceptedBidId: r.accepted_bid_id ?? undefined,
  agreedPrice: r.agreed_price ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const fromT = (t: Task): TRow => ({
  id: t.id,
  client_id: t.clientId,
  client_name: t.clientName,
  is_example: t.isExample,
  category: t.category,
  title: t.title,
  title_ne: t.titleNe ?? null,
  details: t.details,
  quantity: t.quantity,
  days: t.days,
  city: t.city,
  area: t.area ?? null,
  lat: t.lat ?? null,
  lng: t.lng ?? null,
  online: t.online,
  women_only: t.womenOnly,
  budget: t.budget,
  fair_low: t.fairLow,
  fair_high: t.fairHigh,
  due_date: t.dueDate ?? null,
  flexible: t.flexible,
  family_country: t.forFamilyAbroad?.country ?? null,
  family_name: t.forFamilyAbroad?.familyName ?? null,
  abroad: t.abroad ?? null,
  photos: t.photos,
  ai_source: t.aiSource,
  status: t.status,
  accepted_bid_id: t.acceptedBidId ?? null,
  agreed_price: t.agreedPrice ?? null,
  created_at: t.createdAt,
  updated_at: t.updatedAt,
});
type BRow = {
  id: string;
  request_id: string;
  provider_id: string | null;
  provider_ref: string;
  provider_name: string;
  is_example: boolean;
  amount: number;
  days: number;
  message: string | null;
  status: Bid["status"];
  counter: Bid["counter"] | null;
  appear_at: string;
  created_at: string;
  updated_at: string;
};
const toB = (r: BRow): Bid => ({
  id: r.id,
  taskId: r.request_id,
  providerId: r.provider_ref,
  providerName: r.provider_name,
  isExample: r.is_example,
  amount: r.amount,
  days: r.days,
  message: r.message ?? "",
  status: r.status,
  counter: r.counter ?? undefined,
  appearAt: r.appear_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});
const fromB = (b: Bid): BRow => ({
  id: b.id,
  request_id: b.taskId,
  provider_id: b.isExample ? null : b.providerId,
  provider_ref: b.providerId,
  provider_name: b.providerName,
  is_example: b.isExample,
  amount: b.amount,
  days: b.days,
  message: b.message,
  status: b.status,
  counter: b.counter ?? null,
  appear_at: b.appearAt,
  created_at: b.createdAt,
  updated_at: b.updatedAt,
});
type QRow = {
  id: string;
  request_id: string;
  asker_id: string;
  asker_name: string;
  body: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

const taskMethods = {
  async listTasks() {
    const { data, error } = await db().from("requests").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as TRow[]).map(toT);
  },
  async getTask(id: string) {
    const { data, error } = await db().from("requests").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toT(data as TRow) : null;
  },
  async putTask(t: Task) {
    const { error } = await db().from("requests").upsert(fromT(t));
    if (error) throw new Error(error.message);
    return t;
  },
  async listBids(taskId: string) {
    const { data, error } = await db().from("bids").select("*").eq("request_id", taskId);
    if (error) throw new Error(error.message);
    return (data as BRow[]).map(toB);
  },
  async putBid(b: Bid) {
    const { error } = await db().from("bids").upsert(fromB(b));
    if (error) throw new Error(error.message);
    return b;
  },
  async listQuestions(taskId: string) {
    const { data, error } = await db()
      .from("questions")
      .select("*")
      .eq("request_id", taskId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data as QRow[]).map((r) => ({
      id: r.id,
      taskId: r.request_id,
      askerId: r.asker_id,
      askerName: r.asker_name,
      body: r.body,
      answer: r.answer ?? undefined,
      answeredAt: r.answered_at ?? undefined,
      createdAt: r.created_at,
    }));
  },
  async putQuestion(q: Question) {
    const { error } = await db()
      .from("questions")
      .upsert({
        id: q.id,
        request_id: q.taskId,
        asker_id: q.askerId,
        asker_name: q.askerName,
        body: q.body,
        answer: q.answer ?? null,
        answered_at: q.answeredAt ?? null,
        created_at: q.createdAt,
      });
    if (error) throw new Error(error.message);
    return q;
  },
} satisfies Pick<
  Store,
  "listTasks" | "getTask" | "putTask" | "listBids" | "putBid" | "listQuestions" | "putQuestion"
>;

/* ------------------------------------------------------------ bookings, receipts, disputes */
type BkRow = {
  id: string;
  request_id: string;
  bid_id: string;
  client_id: string;
  provider_id: string | null;
  provider_ref: string;
  provider_name: string;
  provider_is_example: boolean;
  total: number;
  fee: number;
  fee_rate: number;
  plan: Booking["plan"];
  method: Booking["method"];
  status: Booking["status"];
  family: Booking["family"] | null;
  created_at: string;
  updated_at: string;
};
type InRow = {
  id: string;
  booking_id: string;
  seq: number;
  label: Installment["label"];
  pct: number;
  amount: number;
  due_date: string;
  state: Installment["state"];
  held_at: string | null;
  delivered_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
};
const toIn = (r: InRow): Installment => ({
  id: r.id,
  seq: r.seq,
  label: r.label,
  pct: r.pct,
  amount: r.amount,
  dueDate: r.due_date,
  state: r.state,
  heldAt: r.held_at ?? undefined,
  deliveredAt: r.delivered_at ?? undefined,
  releasedAt: r.released_at ?? undefined,
  refundedAt: r.refunded_at ?? undefined,
});
async function loadBooking(r: BkRow | null): Promise<Booking | null> {
  if (!r) return null;
  const { data, error } = await db().from("installments").select("*").eq("booking_id", r.id).order("seq");
  if (error) throw new Error(error.message);
  return {
    id: r.id,
    taskId: r.request_id,
    bidId: r.bid_id,
    clientId: r.client_id,
    providerId: r.provider_ref,
    providerName: r.provider_name,
    providerIsExample: r.provider_is_example,
    total: r.total,
    feeRate: Number(r.fee_rate),
    plan: r.plan,
    method: r.method,
    status: r.status,
    installments: (data as InRow[]).map(toIn),
    family: r.family ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const bookingMethods = {
  async getBooking(id: string) {
    const { data, error } = await db().from("bookings").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return loadBooking(data as BkRow | null);
  },
  async getBookingByTask(taskId: string) {
    const { data, error } = await db().from("bookings").select("*").eq("request_id", taskId).maybeSingle();
    if (error) throw new Error(error.message);
    return loadBooking(data as BkRow | null);
  },
  async listBookings() {
    const { data, error } = await db().from("bookings").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (await Promise.all((data as BkRow[]).map(loadBooking))).filter((b): b is Booking => b !== null);
  },
  async putBooking(b: Booking) {
    const { error } = await db()
      .from("bookings")
      .upsert({
        id: b.id,
        request_id: b.taskId,
        bid_id: b.bidId,
        client_id: b.clientId,
        provider_id: b.providerIsExample ? null : b.providerId,
        provider_ref: b.providerId,
        provider_name: b.providerName,
        provider_is_example: b.providerIsExample,
        total: b.total,
        family: b.family ?? null,
        fee: Math.round(b.total * b.feeRate),
        fee_rate: b.feeRate,
        plan: b.plan,
        method: b.method,
        status: b.status,
        created_at: b.createdAt,
        updated_at: b.updatedAt,
      });
    if (error) throw new Error(error.message);
    const { error: e2 } = await db()
      .from("installments")
      .upsert(
        b.installments.map((i) => ({
          id: i.id,
          booking_id: b.id,
          seq: i.seq,
          label: i.label,
          pct: i.pct,
          amount: i.amount,
          due_date: i.dueDate,
          state: i.state,
          held_at: i.heldAt ?? null,
          delivered_at: i.deliveredAt ?? null,
          released_at: i.releasedAt ?? null,
          refunded_at: i.refundedAt ?? null,
        })),
      );
    if (e2) throw new Error(e2.message);
    return b;
  },
  async listReceipts(bookingId: string) {
    const { data, error } = await db()
      .from("payments")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        booking_id: string;
        installment_id: string;
        direction: Receipt["kind"];
        amount: number;
        fee: number;
        method: Receipt["method"];
        provider_ref: string;
        receipt_no: string;
        created_at: string;
      }[]
    ).map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      installmentId: r.installment_id,
      kind: r.direction,
      amount: r.amount,
      fee: r.fee,
      method: r.method,
      ref: r.provider_ref,
      receiptNo: r.receipt_no,
      createdAt: r.created_at,
    }));
  },
  async putReceipt(r: Receipt) {
    const { error } = await db().from("payments").upsert({
      id: r.id,
      booking_id: r.bookingId,
      installment_id: r.installmentId,
      direction: r.kind,
      amount: r.amount,
      fee: r.fee,
      method: r.method,
      provider_ref: r.ref,
      receipt_no: r.receiptNo,
      created_at: r.createdAt,
    });
    if (error) throw new Error(error.message);
    return r;
  },
  async listDisputes(bookingId: string) {
    const { data, error } = await db()
      .from("disputes")
      .select("*")
      .eq("booking_id", bookingId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        booking_id: string;
        opened_by: string;
        role: Dispute["role"];
        reason: string;
        wanted: Dispute["wanted"];
        status: Dispute["status"];
        resolution: string | null;
        created_at: string;
        resolved_at: string | null;
      }[]
    ).map((d) => ({
      id: d.id,
      bookingId: d.booking_id,
      openedBy: d.opened_by,
      role: d.role,
      reason: d.reason,
      wanted: d.wanted,
      status: d.status,
      resolution: d.resolution ?? undefined,
      createdAt: d.created_at,
      resolvedAt: d.resolved_at ?? undefined,
    }));
  },
  async putDispute(d: Dispute) {
    const { error } = await db()
      .from("disputes")
      .upsert({
        id: d.id,
        booking_id: d.bookingId,
        opened_by: d.openedBy,
        role: d.role,
        reason: d.reason,
        wanted: d.wanted,
        status: d.status,
        resolution: d.resolution ?? null,
        created_at: d.createdAt,
        resolved_at: d.resolvedAt ?? null,
      });
    if (error) throw new Error(error.message);
    return d;
  },
} satisfies Pick<
  Store,
  | "getBooking"
  | "getBookingByTask"
  | "listBookings"
  | "putBooking"
  | "listReceipts"
  | "putReceipt"
  | "listDisputes"
  | "putDispute"
>;

/* ------------------------------------------------------------ messaging */
type CRow = {
  id: string;
  request_id: string | null;
  client_id: string;
  provider_id: string;
  created_at: string;
  last_at: string;
};
const toC = (r: CRow): Conversation => ({
  id: r.id,
  taskId: r.request_id,
  clientId: r.client_id,
  providerId: r.provider_id,
  createdAt: r.created_at,
  lastAt: r.last_at,
});
type MRow = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: Message["kind"];
  body: string | null;
  system: Message["system"] | null;
  file: Message["file"] | null;
  read_by: string[];
  created_at: string;
};
const toM = (r: MRow): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  kind: r.kind,
  body: r.body ?? "",
  system: r.system ?? undefined,
  file: r.file ?? undefined,
  readBy: r.read_by ?? [],
  createdAt: r.created_at,
});
type NRow = {
  id: string;
  user_id: string;
  kind: Notification["kind"];
  code: string;
  params: Notification["params"];
  href: string | null;
  read_at: string | null;
  created_at: string;
};

const messagingMethods = {
  async listConversations(userId: string) {
    const { data, error } = await db()
      .from("conversations")
      .select("*")
      .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
      .order("last_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as CRow[]).map(toC);
  },
  async getConversation(id: string) {
    const { data, error } = await db().from("conversations").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toC(data as CRow) : null;
  },
  async findConversation(clientId: string, providerId: string, taskId: string | null) {
    let q = db().from("conversations").select("*").eq("client_id", clientId).eq("provider_id", providerId);
    q = taskId ? q.eq("request_id", taskId) : q.is("request_id", null);
    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toC(data as CRow) : null;
  },
  async putConversation(c: Conversation) {
    const { error } = await db().from("conversations").upsert({
      id: c.id,
      request_id: c.taskId,
      client_id: c.clientId,
      provider_id: c.providerId,
      created_at: c.createdAt,
      last_at: c.lastAt,
    });
    if (error) throw new Error(error.message);
    return c;
  },
  async listMessages(conversationId: string) {
    const { data, error } = await db()
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data as MRow[]).map(toM);
  },
  async putMessage(m: Message) {
    const { error } = await db()
      .from("messages")
      .upsert({
        id: m.id,
        conversation_id: m.conversationId,
        sender_id: m.senderId,
        kind: m.kind,
        body: m.body,
        system: m.system ?? null,
        file: m.file ?? null,
        read_by: m.readBy,
        created_at: m.createdAt,
      });
    if (error) throw new Error(error.message);
    return m;
  },
  async listNotifications(userId: string) {
    const { data, error } = await db()
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data as NRow[]).map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      code: r.code,
      params: r.params,
      href: r.href ?? "/",
      readAt: r.read_at ?? undefined,
      createdAt: r.created_at,
    }));
  },
  async putNotification(n: Notification) {
    const { error } = await db()
      .from("notifications")
      .upsert({
        id: n.id,
        user_id: n.userId,
        kind: n.kind,
        code: n.code,
        params: n.params,
        title: n.code,
        href: n.href,
        read_at: n.readAt ?? null,
        created_at: n.createdAt,
      });
    if (error) throw new Error(error.message);
    return n;
  },
} satisfies Pick<
  Store,
  | "listConversations"
  | "getConversation"
  | "findConversation"
  | "putConversation"
  | "listMessages"
  | "putMessage"
  | "listNotifications"
  | "putNotification"
>;

/* ------------------------------------------------------------ wallet */
type RRow = {
  id: string;
  booking_id: string;
  task_id: string | null;
  rater_id: string;
  ratee_id: string;
  stars: number;
  body: string | null;
  created_at: string;
};
const toR = (r: RRow): Rating => ({
  id: r.id,
  bookingId: r.booking_id,
  taskId: r.task_id ?? "",
  raterId: r.rater_id,
  rateeId: r.ratee_id,
  stars: r.stars,
  text: r.body ?? "",
  createdAt: r.created_at,
});

const walletMethods = {
  async listPayouts(userId: string) {
    const { data, error } = await db().from("payouts").select("*").eq("user_id", userId).order("created_at");
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        user_id: string;
        amount: number;
        method: Payout["method"];
        ref: string;
        status: Payout["status"];
        created_at: string;
      }[]
    ).map((p) => ({
      id: p.id,
      userId: p.user_id,
      amount: p.amount,
      method: p.method,
      ref: p.ref,
      status: p.status,
      createdAt: p.created_at,
    }));
  },
  async putPayout(p: Payout) {
    const { error } = await db().from("payouts").upsert({
      id: p.id,
      user_id: p.userId,
      amount: p.amount,
      method: p.method,
      ref: p.ref,
      status: p.status,
      created_at: p.createdAt,
    });
    if (error) throw new Error(error.message);
    return p;
  },
  async listRatingsFor(rateeId: string) {
    const { data, error } = await db()
      .from("ratings")
      .select("*")
      .eq("ratee_id", rateeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as RRow[]).map(toR);
  },
  async getRatingByBooking(bookingId: string) {
    const { data, error } = await db().from("ratings").select("*").eq("booking_id", bookingId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toR(data as RRow) : null;
  },
  async putRating(r: Rating) {
    const { error } = await db()
      .from("ratings")
      .upsert({
        id: r.id,
        booking_id: r.bookingId,
        task_id: r.taskId || null,
        rater_id: r.raterId,
        ratee_id: r.rateeId,
        stars: r.stars,
        body: r.text,
        created_at: r.createdAt,
      });
    if (error) throw new Error(error.message);
    return r;
  },
  async listCreditApplications(userId: string) {
    const { data, error } = await db()
      .from("credit_applications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        user_id: string;
        amount: number;
        months: CreditApplication["months"];
        purpose: string;
        limit_at_apply: number;
        status: CreditApplication["status"];
        created_at: string;
      }[]
    ).map((a) => ({
      id: a.id,
      userId: a.user_id,
      amount: a.amount,
      months: a.months,
      purpose: a.purpose,
      limitAtApply: a.limit_at_apply,
      status: a.status,
      createdAt: a.created_at,
    }));
  },
  async putCreditApplication(a: CreditApplication) {
    const { error } = await db().from("credit_applications").upsert({
      id: a.id,
      user_id: a.userId,
      amount: a.amount,
      months: a.months,
      purpose: a.purpose,
      limit_at_apply: a.limitAtApply,
      status: a.status,
      created_at: a.createdAt,
    });
    if (error) throw new Error(error.message);
    return a;
  },
} satisfies Pick<
  Store,
  | "listPayouts"
  | "putPayout"
  | "listRatingsFor"
  | "getRatingByBooking"
  | "putRating"
  | "listCreditApplications"
  | "putCreditApplication"
>;

/* ------------------------------------------------------------ safety & admin */
const ok = <T>(r: { data: T; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

const safetyMethods = {
  async listReports() {
    const rows = ok(await db().from("reports").select("*").order("created_at", { ascending: false })) as {
      id: string;
      reporter_id: string;
      target_user: string | null;
      target_task: string | null;
      reason: Report["reason"];
      details: string;
      status: Report["status"];
      created_at: string;
      updated_at: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      targetUserId: r.target_user ?? undefined,
      targetTaskId: r.target_task ?? undefined,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },
  async putReport(r: Report) {
    ok(
      await db()
        .from("reports")
        .upsert({
          id: r.id,
          reporter_id: r.reporterId,
          target_user: r.targetUserId ?? null,
          target_task: r.targetTaskId ?? null,
          reason: r.reason,
          details: r.details,
          status: r.status,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        }),
    );
    return r;
  },
  async listBlocks(userId: string) {
    const rows = ok(
      await db().from("blocks").select("*").or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
    ) as { id: string; blocker_id: string; blocked_id: string; created_at: string }[];
    return rows.map((b) => ({
      id: b.id,
      blockerId: b.blocker_id,
      blockedId: b.blocked_id,
      createdAt: b.created_at,
    }));
  },
  async putBlock(b: Block) {
    ok(
      await db()
        .from("blocks")
        .upsert(
          { id: b.id, blocker_id: b.blockerId, blocked_id: b.blockedId, created_at: b.createdAt },
          { onConflict: "blocker_id,blocked_id" },
        ),
    );
    return b;
  },
  async deleteBlock(blockerId: string, blockedId: string) {
    ok(await db().from("blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId));
  },
  async listPriceOverrides() {
    const rows = ok(
      await db()
        .from("price_table")
        .select("category, low, high, per_day, updated_by, updated_at")
        .not("updated_by", "is", null),
    ) as {
      category: string;
      low: number;
      high: number;
      per_day: number;
      updated_by: string;
      updated_at: string;
    }[];
    return rows.map((r) => ({
      category: r.category,
      low: r.low,
      high: r.high,
      perDay: r.per_day,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
    }));
  },
  async putPriceOverride(p: PriceOverride) {
    ok(
      await db()
        .from("price_table")
        .update({
          low: p.low,
          high: p.high,
          per_day: p.perDay,
          updated_by: p.updatedBy,
          updated_at: p.updatedAt,
        })
        .eq("category", p.category),
    );
    return p;
  },
  async purgeDemoData(demoIds: string[]) {
    if (!demoIds.length) return;
    const list = `(${demoIds.join(",")})`;
    const bookings = ok(
      await db().from("bookings").select("id").or(`client_id.in.${list},provider_id.in.${list}`),
    ) as { id: string }[];
    const bIds = bookings.map((b) => b.id);
    if (bIds.length) {
      ok(await db().from("disputes").delete().in("booking_id", bIds));
      ok(await db().from("ratings").delete().in("booking_id", bIds));
      ok(await db().from("payments").delete().in("booking_id", bIds));
      ok(await db().from("installments").delete().in("booking_id", bIds));
      ok(await db().from("bookings").delete().in("id", bIds));
    }
    ok(await db().from("requests").delete().eq("is_example", true));
    ok(await db().from("abroad_jobs").delete().eq("is_demo", true));
    // Remaining rows (requests, bids, conversations, messages, notifications, payouts, credit, reports, blocks,
    // verifications) cascade from users; demo users are re-created by resetDemo afterwards.
  },
} satisfies Pick<
  Store,
  | "listReports"
  | "putReport"
  | "listBlocks"
  | "putBlock"
  | "deleteBlock"
  | "listPriceOverrides"
  | "putPriceOverride"
  | "purgeDemoData"
>;

const abroadMethods = {
  async listAbroadJobs() {
    return (ok(await db().from("abroad_jobs").select("data")) as { data: AbroadJob }[]).map((r) => r.data);
  },
  async getAbroadJob(id: string) {
    const row = ok(await db().from("abroad_jobs").select("data").eq("id", id).maybeSingle()) as {
      data: AbroadJob;
    } | null;
    return row?.data ?? null;
  },
  async putAbroadJob(j: AbroadJob) {
    ok(
      await db().from("abroad_jobs").upsert({ id: j.id, client_id: j.clientId, is_demo: j.isDemo, data: j }),
    );
    return j;
  },
} satisfies Pick<Store, "listAbroadJobs" | "getAbroadJob" | "putAbroadJob">;

export const supabaseStore: Store = {
  ...base,
  ...abroadMethods,
  ...verificationMethods,
  ...taskMethods,
  ...bookingMethods,
  ...messagingMethods,
  ...walletMethods,
  ...safetyMethods,
};
