import nodemailer from "nodemailer";

// Sends mail through Gmail SMTP using the shop's own Gmail account + an App
// Password (not the account password — generate one at
// https://myaccount.google.com/apppasswords with 2-Step Verification on).
// Both env vars are optional in dev: if unset, sendEmail() just logs and
// no-ops instead of throwing, so local work isn't blocked on email setup.
function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    // Explicit host/port (587 STARTTLS) is more reliable on hosts where the
    // implicit-TLS 465 connection stalls. Timeouts ensure a blocked SMTP
    // connection fails fast instead of hanging the request forever.
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass },
    connectionTimeout: 15000, // ms to establish TCP
    greetingTimeout: 10000, // ms to wait for SMTP greeting
    socketTimeout: 20000, // ms of inactivity before aborting
  });
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping send:", opts.subject);
    return false;
  }
  try {
    await transport.sendMail({
      from: `BadgyTCG <${process.env.GMAIL_USER}>`,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      attachments: opts.attachments,
    });
    return true;
  } catch (err) {
    // Credentials are set but Gmail rejected the send (bad App Password, 2FA
    // off, "from" mismatch, etc.). Surface the real reason instead of letting
    // the caller crash with an opaque 500.
    const raw = err instanceof Error ? err.message : String(err);
    // Gmail auth failures look like "535-5.7.8 Username and Password not accepted"
    const friendly = /invalid login|username and password not accepted|535/i.test(raw)
      ? "Gmail rejected the login — check GMAIL_APP_PASSWORD (must be a 16-char App Password with no spaces) and that GMAIL_USER matches the account."
      : /timeout|etimedout|econnrefused|econnreset|greeting/i.test(raw)
        ? "Couldn't reach Gmail's mail server (connection timed out). This is usually the host blocking outbound SMTP — try again, and if it keeps happening the mail port may be blocked."
        : `Gmail send failed: ${raw}`;
    console.error("[email] send failed:", raw);
    throw new Error(friendly);
  }
}

// Where order-placed alerts go — defaults to the first admin email so no
// separate env var is needed on top of ADMIN_EMAILS.
export function adminAlertEmail(): string | null {
  return (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null;
}
