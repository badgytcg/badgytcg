"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

const TABS = [
  { name: "Requests", href: "/admin/requests" },
  { name: "Inventory", href: "/admin/inventory" },
  { name: "Foils", href: "/admin/foils" },
  { name: "Special", href: "/admin/special" },
  { name: "Scan", href: "/admin/scan" },
  { name: "Orders", href: "/admin/orders" },
  { name: "Consigners", href: "/admin/consigners" },
  { name: "Sales Report", href: "/admin/consigner-report" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return <div className="mx-auto max-w-2xl px-6 py-16 text-center text-zinc-500">Loading...</div>;
  }

  if (status !== "authenticated") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-zinc-100">Admin sign in</h1>
        <button
          onClick={() => signIn("google")}
          className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 text-sm font-medium text-zinc-100 hover:border-purple-500"
        >
          Continue with Google
        </button>
      </div>
    );
  }

  // The session itself doesn't carry an "isAdmin" flag — every admin API
  // route re-checks isAdminEmail() server-side regardless, so a non-admin
  // signed-in user seeing this shell can't actually fetch or mutate anything.
  // This client-side message is just to avoid a confusing blank/broken page.
  if (!session?.user?.email) {
    return <div className="mx-auto max-w-md px-6 py-16 text-center text-zinc-400">Not authorized.</div>;
  }

  return (
    <div>
      <div className="border-b border-zinc-800 bg-zinc-900/50 print:hidden">
        <nav className="mx-auto flex max-w-5xl gap-4 px-6">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 px-1 py-3 text-sm font-medium ${
                  active ? "border-purple-500 text-purple-300" : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
