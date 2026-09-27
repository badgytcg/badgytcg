"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function SupportPage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill from the signed-in account if available.
  useEffect(() => {
    if (session?.user?.name) setName((n) => n || session.user!.name!);
    if (session?.user?.email) setEmail((e) => e || session.user!.email!);
  }, [session]);

  async function submit() {
    setError(null);
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email, and message.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, orderRef, message }),
      });
      const data = await res.json();
      if (res.ok) setSent(true);
      else setError(data.error ?? "Couldn't send your message. Try again.");
    } catch {
      setError("Couldn't reach the server. Try again.");
    }
    setSending(false);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="text-4xl">🐧</div>
        <h1 className="mt-4 text-2xl font-bold text-zinc-100">Message sent!</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Thanks for reaching out — we&apos;ll get back to you at <span className="text-zinc-200">{email}</span> as
          soon as we can.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-100">Contact &amp; Support</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Questions about an order, a card, shipping, or anything else? Send us a message and we&apos;ll
        get back to you by email. You can also reach us directly at{" "}
        <a href="mailto:badgytcg@gmail.com" className="text-purple-400 hover:underline">badgytcg@gmail.com</a>.
      </p>

      <div className="mt-6 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="Your email"
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </div>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <input
          value={orderRef}
          onChange={(e) => setOrderRef(e.target.value)}
          placeholder="Order number (optional)"
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="How can we help?"
          rows={6}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          onClick={submit}
          disabled={sending}
          className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:bg-zinc-700"
        >
          {sending ? "Sending…" : "Send message"}
        </button>
      </div>
    </div>
  );
}
