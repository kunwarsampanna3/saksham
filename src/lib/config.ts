import "server-only";

/** Server-side runtime configuration. Never import from client components. */
export const config = {
  /** Demo affordances: one-tap accounts, on-screen sandbox OTP, demo reset. Off in production. */
  demoMode: process.env.DEMO_MODE === "true",
  isProd: process.env.NODE_ENV === "production",
  appOrigin: process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  /** A header your proxy overwrites with the visitor's IP. Empty: no IP header is trusted (see auth/http.ts). */
  trustedIpHeader: process.env.TRUSTED_IP_HEADER ?? "",
  /**
   * Automatic selfie ↔ ID matching needs about 700 MB. FACE_MATCH=on/off decides; otherwise it is on,
   * except on Render (512 MB on Free), where selfies go to admin review instead.
   */
  faceMatch: process.env.FACE_MATCH ? process.env.FACE_MATCH === "on" : process.env.RENDER !== "true",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
  /** Most Claude calls a day for the whole site, so a busy or abused site can't run up the bill. */
  aiDailyLimit: Number(process.env.AI_DAILY_LIMIT) || 500,
  /** Outgoing email for sign-in codes (Resend key, or SMTP such as Gmail with an app password). */
  email: {
    from: process.env.EMAIL_FROM ?? "",
    resendKey: process.env.RESEND_API_KEY ?? "",
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: Number(process.env.SMTP_PORT ?? 465),
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
  },
  /** Support contact shown on /contact; empty values are hidden. */
  support: { email: process.env.SUPPORT_EMAIL ?? "", phone: process.env.SUPPORT_PHONE ?? "" },
  /** Owner/admin phone numbers (10 digits, comma-separated). These accounts get /admin. */
  ownerPhones: (process.env.OWNER_PHONES ?? "")
    .split(",")
    .map((p) => p.replace(/\D/g, "").slice(-10))
    .filter((p) => /^9[78]\d{8}$/.test(p)),
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
