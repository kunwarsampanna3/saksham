import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { config } from "@/lib/config";

/**
 * Outgoing email for sign-in codes. Two ways to configure it (in .env.local):
 *  - RESEND_API_KEY + EMAIL_FROM                         (Resend HTTP API)
 *  - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS + EMAIL_FROM (any SMTP, e.g. Gmail with an app password)
 * Without either, emailConfigured() is false and the caller decides what to do (demo: show the code on screen).
 */
export function emailConfigured(): boolean {
  const e = config.email;
  return Boolean(e.from && (e.resendKey || (e.smtpHost && e.smtpUser && e.smtpPass)));
}

let transport: Transporter | null = null;
function smtp() {
  const e = config.email;
  transport ??= nodemailer.createTransport({
    host: e.smtpHost,
    port: e.smtpPort,
    secure: e.smtpPort === 465,
    auth: { user: e.smtpUser, pass: e.smtpPass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
  return transport;
}

export async function sendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!emailConfigured()) return false;
  const e = config.email;
  try {
    if (e.resendKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${e.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: e.from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    }
    await smtp().sendMail({ from: e.from, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("[saksham] email send failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

/** The 6-digit code email, in English and Nepali. No links, so it can't be mistaken for phishing. */
export function codeEmail(code: string, purpose: "signup" | "reset") {
  const why = purpose === "signup" ? "to finish creating your Saksham account" : "to reset your Saksham MPIN";
  const whyNe = purpose === "signup" ? "सक्षम खाता बनाउन" : "सक्षम MPIN फेर्न";
  const subject = `${code} is your Saksham code`;
  const text = [
    `Your Saksham code is ${code}`,
    `Use it ${why}. It is valid for 5 minutes.`,
    "Never share this code. Saksham staff will never ask for it.",
    "If you didn't ask for this code, you can ignore this email.",
    "",
    `तपाईंको सक्षम कोड ${code} हो। ${whyNe} प्रयोग गर्नुहोस्। यो ५ मिनेटसम्म मात्र चल्छ। यो कोड कसैलाई नदिनुहोस्।`,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#F6F8F2;font-family:Arial,Helvetica,sans-serif;color:#0D1A14">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px">
    <p style="margin:0 0 4px;font-size:20px;font-weight:800;color:#0E3B2C">Saksham <span style="color:#1E8E4E">सक्षम</span></p>
    <div style="background:#ffffff;border:1px solid #d5e0d7;border-radius:12px;padding:24px;margin-top:16px">
      <p style="margin:0 0 12px;font-size:16px">Your code ${why}:</p>
      <p style="margin:0 0 16px;font-size:34px;font-weight:800;letter-spacing:8px;color:#0E3B2C">${code}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#45564d">Valid for 5 minutes. Never share this code — Saksham staff will never ask for it.</p>
      <p style="margin:0;font-size:14px;color:#45564d">तपाईंको कोड ${code} हो। ${whyNe} प्रयोग गर्नुहोस्। यो कोड कसैलाई नदिनुहोस्।</p>
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7a71">If you didn't ask for this code, you can ignore this email.</p>
  </div></body></html>`;
  return { subject, text, html };
}
