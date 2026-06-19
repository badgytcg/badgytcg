// Comma-separated list of emails allowed into /admin and the admin APIs.
// Set ADMIN_EMAILS in your environment (e.g. "badgytcg@gmail.com").
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
