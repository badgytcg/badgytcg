import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, adminAlertEmail } from "@/lib/email";
import { isRateLimited, clientKeyFor } from "@/lib/rateLimit";

// Public support / contact form. Anyone can submit, so it's rate-limited.
// The message is stored (so nothing is lost) and emailed to the admin with
// reply-to set to the customer, so a Gmail reply goes straight back to them.
export async function POST(request: Request) {
  if (isRateLimited(clientKeyFor(request, "contact"), 5, 60_000)) {
    return NextResponse.json({ error: "Too many messages — please wait a minute and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const orderRef = String(body.orderRef ?? "").trim() || null;

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Please fill in your name, email, and message." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  const saved = await prisma.contactMessage.create({
    data: { name, email, subject: subject || "(no subject)", message, orderRef },
  });

  // Best-effort admin notification — never fail the submission on email.
  const to = adminAlertEmail();
  if (to) {
    try {
      await sendEmail({
        to,
        replyTo: email,
        subject: `Support: ${subject || "New message"} — from ${name}`,
        text: [
          `New support message from your BadgyTCG contact form.`,
          "",
          `Name:  ${name}`,
          `Email: ${email}`,
          orderRef ? `Order: ${orderRef}` : "",
          `Subject: ${subject || "(none)"}`,
          "",
          "Message:",
          message,
          "",
          "— Reply to this email to respond directly to the customer.",
        ].filter(Boolean).join("\n"),
      });
    } catch (err) {
      console.error("[contact email] failed:", err);
    }
  }

  return NextResponse.json({ ok: true, id: saved.id });
}
