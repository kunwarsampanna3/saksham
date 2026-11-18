import "server-only";

/** Server-side runtime configuration. Never import from client components. */
export const config = {
  /** Demo affordances: one-tap accounts, on-screen sandbox OTP, demo reset. Off in production. */
  demoMode: process.env.DEMO_MODE === "true",
  isProd: process.env.NODE_ENV === "production",
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  /** Support contact shown on /contact; empty values are hidden. */
  support: { email: process.env.SUPPORT_EMAIL ?? "", phone: process.env.SUPPORT_PHONE ?? "" },
  /** Owner/admin phone numbers (10 digits, comma-separated). These accounts get /admin. */
  ownerPhones: (process.env.OWNER_PHONES ?? "").split(",").map((p) => p.replace(/\D/g, "").slice(-10)).filter((p) => /^9[78]\d{8}$/.test(p)),
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  sms: {
    provider: process.env.SMS_PROVIDER ?? "",
    token: process.env.SMS_API_TOKEN ?? "",
    sender: process.env.SMS_SENDER_ID ?? "",
  },
} as const;

export const useSupabase = Boolean(config.supabase.url && config.supabase.serviceKey);

const g = globalThis as { __sakshamDemoWarned?: boolean };
if (config.isProd && config.demoMode && process.env.ALLOW_DEMO_IN_PROD !== "true" && !g.__sakshamDemoWarned) {
  g.__sakshamDemoWarned = true; // once per process, not once per page
  // A loud warning rather than a crash, so a staging deploy can still opt in explicitly.
  console.warn("[saksham] DEMO_MODE is on in a production build. Set DEMO_MODE=false before launch.");
}

/** Security policy constants (shared by routes). */
export const policy = {
  mpinMaxAttempts: 5,
  mpinLockMinutes: 15,
  otpTtlSeconds: 300,
  otpMaxAttempts: 5,
  otpResendSeconds: 30,
  sessionDays: 7,
  /** Payments require MPIN again after this much idle time. */
  paymentReauthSeconds: 5 * 60,
} as const;
