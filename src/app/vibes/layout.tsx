"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Browse Singles", href: "/vibes" },
  { name: "Import a Deck", href: "/vibes/deck-import" },
];

export default function VibesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <nav className="mx-auto flex max-w-6xl gap-4 px-6">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 px-1 py-3 text-sm font-medium ${
                  active
                    ? "border-purple-500 text-purple-300"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
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
