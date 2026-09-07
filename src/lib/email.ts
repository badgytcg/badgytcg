import nodemailer from "nodemailer";

// Email is sent one of two ways, in priority order:
//
//  1. Resend (RESEND_API_KEY set) — an HTTP email API over port 443. Use this
//     in production: most cloud hosts (Railway included) block outbound SMTP,
//     so Gmail/SMTP silently times out there. Resend needs a verified sender
//     domain; set FROM_EMAIL to an address on it (e.g. orders@badgytcg.com).
//
//  2. Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD) — fine for local dev where
//     SMTP isn't blocked. Falls back to this if Resend isn't configured.
//
// If neither is configured, sendEmail() no-ops (returns false) so local work
// isn't blocked on email setup.

interface EmailOpts {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}

function fromAddress(): string {
  const addr = process.env.FROM_EMAIL || process.env.GMAIL_USER || "onboarding@resend.dev";
  return `BadgyTCG <${addr}>`;
}

// --- Resend (HTTP) ---
async function sendViaResend(opts: EmailOpts, apiKey: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        // Resend takes attachment content as base64.
        attachments: opts.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content).toString("base64"),
        })),
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("[email:resend] request failed:", raw);
    throw new Error(`Couldn't reach the email service: ${raw}`);
  }

  if (res.ok) return true;

  const detail = await res.text().catch(() => "");
  console.error("[email:resend] send failed:", res.status, detail);
  // Common Resend errors: 401 (bad key), 403 (unverified from-domain).
  const friendly =
    res.status === 401
      ? "Email service rejected the API key — check RESEND_API_KEY."
      : res.status === 403 || /domain is not verified|not verified/i.test(detail)
        ? "The sender address isn't verified with the email service yet — verify your domain in Resend and set FROM_EMAIL to an address on it (e.g. orders@badgytcg.com)."
        : `Email service error (${res.status}): ${detail || "unknown"}`;
  throw new Error(friendly);
}

// --- Gmail SMTP (dev fallback) ---
function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

async function sendViaGmail(opts: EmailOpts): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] no email provider configured — skipping send:", opts.subject);
    return false;
  }
  try {
    await transport.sendMail({
      from: fromAddress(),
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      attachments: opts.attachments,
    });
    return true;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const friendly = /invalid login|username and password not accepted|535/i.test(raw)
      ? "Gmail rejected the login — check GMAIL_APP_PASSWORD (must be a 16-char App Password with no spaces) and that GMAIL_USER matches the account."
      : /timeout|etimedout|econnrefused|econnreset|greeting/i.test(raw)
        ? "Couldn't reach Gmail's mail server (connection timed out) — this host is blocking outbound SMTP. Set up Resend (RESEND_API_KEY) to send email over HTTPS instead."
        : `Gmail send failed: ${raw}`;
    console.error("[email:gmail] send failed:", raw);
    throw new Error(friendly);
  }
}

export async function sendEmail(opts: EmailOpts): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return sendViaResend(opts, resendKey);
  return sendViaGmail(opts);
}

// Where order-placed alerts go — defaults to the first admin email so no
// separate env var is needed on top of ADMIN_EMAILS.
export function adminAlertEmail(): string | null {
  return (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null;
}
