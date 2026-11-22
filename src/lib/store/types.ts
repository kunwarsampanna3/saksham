export type Role = "client" | "provider";

export interface Passkey {
  id: string; // base64url credential id
  publicKey: string; // base64url COSE public key
  counter: number;
  transports?: string[];
  createdAt: string;
  label: string;
}

export interface User {
  id: string;
  phone: string; // local 10-digit, e.g. 9812345678 — "" for accounts created with email only
  /** Verified email (lower-case). Optional; accounts can sign in with phone or email. */
  email?: string;
  name: string;
  city: string;
  roles: Role[];
  activeRole: Role;
  mpinHash: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lang: "en" | "ne";
  isDemo: boolean;
  isAdmin: boolean;
  /** Self-declared; women-only requests are shown only to women providers. Verified via the women-group step. */
  gender?: "female" | "male" | "other";
  /** Saved location (Location page). Area centroid only — never an exact address. */
  area?: string;
  lat?: number;
  lng?: number;
  /** Provider service radius in km */
  radiusKm?: number;
  /** Safety: up to 3 people alerted by SOS (demo) and live-location sharing (demo). */
  trustedContacts?: { name: string; phone: string }[];
  /** Denormalised trust badges, updated when a verification decision is made. */
  verified?: boolean;
  womenLed?: boolean;
  /** Display-only tag used for the demo personas; real accounts get it from verification. */
  headline?: string;
  /** Categories chosen at sign-up: skills offered (providers) or what they usually need (clients). */
  categories?: string[];
  /** Opted in to product updates and offers (unticked by default). */
  marketingOptIn?: boolean;
  /** When the user accepted the Terms and Privacy Policy. */
  termsAcceptedAt?: string;
  passkeys: Passkey[];
  /** Goes up when every session must end (MPIN reset). Missing means 0. */
  sessionVersion?: number;
  /** Signed-out sessions, kept until their token would have expired anyway. */
  revokedSessions?: { sid: string; until: string }[];
  createdAt: string;
  updatedAt: string;
}

export type OtpPurpose = "signup" | "reset";

export interface OtpRecord {
  key: string; // `${purpose}:${phone}`
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  lastSentAt: string;
}

/** Public, safe-to-send shape of a user. Never includes hashes or counters. */
export interface PublicUser {
  id: string;
  phoneMasked: string;
  name: string;
  city: string;
  roles: Role[];
  activeRole: Role;
  lang: "en" | "ne";
  isDemo: boolean;
  isAdmin: boolean;
  hasPasskey: boolean;
  gender?: "female" | "male" | "other";
  area?: string;
  radiusKm?: number;
  verified: boolean;
  womenLed: boolean;
}

/* ------------------------------------------------------------ verification */
export type VerificationKind = "phone" | "id" | "selfie" | "address" | "womenGroup";
export type VerificationStatus = "not_started" | "pending" | "verified" | "rejected";

export interface StoredFile {
  id: string; // random, used in the private file URL
  path: string; // storage key, never exposed to clients
  mime: "image/jpeg" | "audio/webm" | "audio/ogg" | "audio/mp4";
  size: number;
  label: string; // front | back | selfie | proof
}

export interface Verification {
  id: string;
  userId: string;
  kind: VerificationKind;
  status: VerificationStatus;
  /** true when the decision was made by a simulated check (demo selfie match, demo reviewer) */
  simulated: boolean;
  files: StoredFile[];
  /** Non-document fields, e.g. docType, ward, tole, groupName, members */
  fields: Record<string, string>;
  note?: string;
  submittedAt?: string;
  decidedAt?: string;
  reviewerId?: string;
  /** documents are deleted this long after a decision */
  purgeAfter?: string;
}

/* ------------------------------------------------------------------ tasks */
export type TaskStatus =
  "open" | "assigned" | "in_progress" | "delivered" | "completed" | "cancelled" | "disputed";

export interface Task {
  id: string;
  /** null for seeded example tasks (no real client) */
  clientId: string | null;
  clientName: string;
  isExample: boolean;
  category: string;
  title: string;
  /** Example tasks carry both languages; user tasks are in the language they were written */
  titleNe?: string;
  details: string;
  quantity: number;
  days: number;
  city: string; // "Online" for remote work
  area?: string;
  lat?: number;
  lng?: number;
  online: boolean;
  womenOnly: boolean;
  budget: number | null;
  fairLow: number; // from the price table — never from AI
  fairHigh: number;
  dueDate?: string; // YYYY-MM-DD
  flexible: boolean;
  forFamilyAbroad?: { country: string; familyName: string };
  photos: StoredFile[];
  aiSource: "ai" | "fallback" | "manual";
  status: TaskStatus;
  acceptedBidId?: string;
  agreedPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export type BidStatus = "active" | "accepted" | "declined" | "withdrawn";
export type CounterStatus = "pending" | "accepted" | "declined";

export interface Bid {
  id: string;
  taskId: string;
  /** user id for real providers; "ex:<slug>" for example providers in demo mode */
  providerId: string;
  providerName: string;
  isExample: boolean;
  amount: number;
  days: number;
  message: string;
  status: BidStatus;
  counter?: { amount: number; status: CounterStatus; at: string; by: "client" };
  /** example offers trickle in: hidden until this time */
  appearAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  taskId: string;
  askerId: string;
  askerName: string;
  body: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ money */
export type PlanKind = "full" | "two" | "milestones";
export type EscrowState = "scheduled" | "held" | "delivered" | "released" | "refunded";
export type PayMethod = "esewa_sandbox" | "khalti_sandbox" | "card_sandbox";

export interface Installment {
  id: string;
  seq: number; // 1-based
  label: "full" | "first" | "second" | "start" | "middle" | "finish";
  pct: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  state: EscrowState;
  heldAt?: string;
  deliveredAt?: string;
  releasedAt?: string;
  refundedAt?: string;
}

export type BookingStatus = "active" | "completed" | "disputed" | "refunded";

export interface Booking {
  id: string;
  taskId: string;
  bidId: string;
  clientId: string;
  /** user id, or "ex:<slug>" for an example provider (demo) */
  providerId: string;
  providerName: string;
  providerIsExample: boolean;
  total: number; // agreed price, paid by the client
  feeRate: number; // example 7%, deducted from the provider payout
  plan: PlanKind;
  method: PayMethod;
  status: BookingStatus;
  installments: Installment[];
  /** Hire-from-abroad: family member in Nepal confirms work through a private link (token stored hashed). */
  family?: {
    name: string;
    tokenHash: string;
    confirmations: { installmentId: string; ok: boolean; note: string; at: string }[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  bookingId: string;
  installmentId: string;
  kind: "hold" | "release" | "refund";
  amount: number;
  fee: number; // fee withheld on release
  method: PayMethod;
  /** sandbox reference — no real money moves in this build */
  ref: string;
  receiptNo: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  bookingId: string;
  openedBy: string;
  role: "client" | "provider";
  reason: string;
  wanted: "redo" | "refund";
  status: "open" | "redo_arranged" | "refunded" | "resolved";
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

/* ------------------------------------------------------------------ messaging */
export interface Conversation {
  id: string;
  taskId: string | null;
  /** exactly two real users: the client and the provider */
  clientId: string;
  providerId: string;
  createdAt: string;
  lastAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  /** null = system message (offers, counters, payments) */
  senderId: string | null;
  kind: "text" | "voice" | "photo" | "system";
  body: string;
  /** system messages carry a code + params so they render in the reader's language */
  system?: { code: string; params: Record<string, string | number> };
  file?: StoredFile & { durationSec?: number };
  readBy: string[];
  createdAt: string;
}

export type NotificationKind = "bid" | "counter" | "payment" | "message" | "verification" | "system";

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  /** code + params, rendered in the reader's language */
  code: string;
  params: Record<string, string | number>;
  href: string;
  readAt?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ wallet */
export interface Payout {
  id: string;
  userId: string;
  amount: number;
  method: PayMethod;
  /** sandbox reference — no real transfer in this build */
  ref: string;
  status: "sent_sandbox";
  createdAt: string;
}

export interface Rating {
  id: string;
  bookingId: string;
  taskId: string;
  raterId: string;
  rateeId: string;
  stars: number; // 1–5
  text: string;
  createdAt: string;
}

export interface CreditApplication {
  id: string;
  userId: string;
  amount: number;
  months: 3 | 6 | 12;
  purpose: string;
  limitAtApply: number;
  /** demo partner only — nothing is sent anywhere */
  status: "submitted_demo";
  createdAt: string;
}

/* ------------------------------------------------------------------ safety & admin */
export interface Report {
  id: string;
  reporterId: string;
  targetUserId?: string;
  targetTaskId?: string;
  reason: "fraud" | "harassment" | "unsafe" | "off_platform" | "fake" | "other";
  details: string;
  status: "open" | "reviewing" | "actioned" | "dismissed";
  createdAt: string;
  updatedAt: string;
}

export interface Block {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

/** Admin price-table edits, applied on top of the built-in example table. */
export interface PriceOverride {
  category: string;
  low: number;
  high: number;
  perDay: number;
  updatedBy: string;
  updatedAt: string;
}

export interface Store {
  /* safety & admin */
  listReports(): Promise<Report[]>;
  putReport(r: Report): Promise<Report>;
  listBlocks(userId: string): Promise<Block[]>;
  putBlock(b: Block): Promise<Block>;
  deleteBlock(blockerId: string, blockedId: string): Promise<void>;
  listPriceOverrides(): Promise<PriceOverride[]>;
  putPriceOverride(p: PriceOverride): Promise<PriceOverride>;
  /** Admin "Reset demo": remove everything created by demo accounts and example data. */
  purgeDemoData(demoUserIds: string[]): Promise<void>;

  /* wallet */
  listPayouts(userId: string): Promise<Payout[]>;
  putPayout(p: Payout): Promise<Payout>;
  listRatingsFor(rateeId: string): Promise<Rating[]>;
  getRatingByBooking(bookingId: string): Promise<Rating | null>;
  putRating(r: Rating): Promise<Rating>;
  listCreditApplications(userId: string): Promise<CreditApplication[]>;
  putCreditApplication(a: CreditApplication): Promise<CreditApplication>;

  /* messaging */
  listConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | null>;
  findConversation(clientId: string, providerId: string, taskId: string | null): Promise<Conversation | null>;
  putConversation(c: Conversation): Promise<Conversation>;
  listMessages(conversationId: string): Promise<Message[]>;
  putMessage(m: Message): Promise<Message>;
  listNotifications(userId: string): Promise<Notification[]>;
  putNotification(n: Notification): Promise<Notification>;

  /* money */
  getBooking(id: string): Promise<Booking | null>;
  getBookingByTask(taskId: string): Promise<Booking | null>;
  listBookings(): Promise<Booking[]>;
  putBooking(b: Booking): Promise<Booking>;
  listReceipts(bookingId: string): Promise<Receipt[]>;
  putReceipt(r: Receipt): Promise<Receipt>;
  listDisputes(bookingId: string): Promise<Dispute[]>;
  putDispute(d: Dispute): Promise<Dispute>;

  /* tasks, bids, Q&A */
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  putTask(t: Task): Promise<Task>;
  listBids(taskId: string): Promise<Bid[]>;
  putBid(b: Bid): Promise<Bid>;
  listQuestions(taskId: string): Promise<Question[]>;
  putQuestion(q: Question): Promise<Question>;

  getUserByPhone(phone: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  /** Real (non-demo) accounts that offer skills. */
  listProviderUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | null>;
  getUserByPasskeyId(credentialId: string): Promise<User | null>;
  createUser(u: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;
  updateUser(id: string, patch: Partial<Omit<User, "id" | "createdAt">>): Promise<User>;
  putOtp(rec: OtpRecord): Promise<void>;
  getOtp(key: string): Promise<OtpRecord | null>;
  deleteOtp(key: string): Promise<void>;
  /** Removes demo-flagged users and re-seeds them (admin "Reset demo"). */
  resetDemo(seed: Omit<User, "id" | "createdAt" | "updatedAt">[]): Promise<void>;
  listVerifications(userId: string): Promise<Verification[]>;
  putVerification(v: Verification): Promise<Verification>;
  deleteVerification(userId: string, kind: VerificationKind): Promise<void>;
  listPendingVerifications(): Promise<Verification[]>;
  /** Verifications that still have files although their retention period ended before `before` (ISO time). */
  listExpiredVerifications(before: string): Promise<Verification[]>;
  /** Private document bytes (ID photos, selfies). Never under /public. */
  putFile(path: string, data: Buffer, mime: string): Promise<void>;
  getFile(path: string): Promise<Buffer | null>;
  deleteFile(path: string): Promise<void>;
}
