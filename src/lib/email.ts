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
    service: "gmail",
    auth: { user, pass },
  });
}

export async function sendEmail(opts: { to: string; subject: string; text: string }): Promise<boolean> {
  const transport = getTransport();
  if (!transport) {
    console.warn("[email] GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping send:", opts.subject);
    return false;
  }
  await transport.sendMail({
    from: `BadgyTCG <${process.env.GMAIL_USER}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
  return true;
}

// Where order-placed alerts go — defaults to the first admin email so no
// separate env var is needed on top of ADMIN_EMAILS.
export function adminAlertEmail(): string | null {
  return (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim() || null;
}
