"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Browse Singles", href: "/vibes" },
  { name: "Graded & Foils", href: "/vibes/special" },
  { name: "Market Prices", href: "/vibes/market" },
  { name: "Import a Deck", href: "/vibes/deck-import" },
];

export default function VibesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative">
      {/* Faint card-art ambiance behind the page — masked to a soft radial
          fade so it blends into the dark background instead of competing
          with the card grid. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center opacity-60"
        style={{
          backgroundImage: "url(/backgrounds/vibes-art-preview.webp)",
          filter: "saturate(1.6) brightness(1.1)",
          maskImage:
            "radial-gradient(ellipse 80% 100% at 50% 0%, black 0%, rgba(0,0,0,0.6) 50%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 100% at 50% 0%, black 0%, rgba(0,0,0,0.6) 50%, transparent 100%)",
        }}
      />

      <div className="relative border-b border-zinc-800 bg-zinc-900/50">
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
      <div className="relative">{children}</div>
    </div>
  );
}
