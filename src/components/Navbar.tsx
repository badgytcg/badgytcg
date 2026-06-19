"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useStore } from "@/context/StoreContext";

// Add new games here as you expand beyond Vibes. `comingSoon: true` renders
// the tab as a disabled badge instead of a link.
const GAMES = [
  { name: "Vibes", href: "/vibes", comingSoon: false },
  { name: "Riftbound", href: "/riftbound", comingSoon: true },
];

export default function Navbar() {
  const { cartCount, wishlist } = useStore();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-10 border-b border-purple-900/40 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-1">
          <span className="bg-gradient-to-r from-yellow-300 via-pink-500 to-purple-500 bg-clip-text text-xl font-extrabold uppercase tracking-wide text-transparent">
            Badgy
          </span>
          <span className="text-sm font-bold uppercase tracking-wide text-zinc-300">TCG</span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-300">
          {session?.user?.isAdmin && (
            <Link href="/admin" className="text-amber-400 hover:text-amber-300">
              Admin
            </Link>
          )}
          <Link href="/wishlist" className="hover:text-purple-300">
            Wishlist{wishlist.length > 0 && <span className="ml-1 text-purple-400">({wishlist.length})</span>}
          </Link>
          <Link href="/account" className="flex items-center gap-2 hover:text-purple-300">
            {status === "authenticated" && session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={session.user.image} alt="" className="h-6 w-6 rounded-full" />
            ) : (
              "Sign in"
            )}
          </Link>
          <Link
            href="/cart"
            className="rounded-full bg-purple-600 px-4 py-1.5 text-white hover:bg-purple-500"
          >
            Cart{cartCount > 0 && ` (${cartCount})`}
          </Link>
        </div>
      </div>
      <nav className="mx-auto flex max-w-6xl items-center gap-1 px-6">
        {GAMES.map((game) => {
          const active = pathname?.startsWith(game.href);

          if (game.comingSoon) {
            return (
              <span
                key={game.href}
                className="flex items-center gap-2 rounded-t-lg px-4 py-2 text-sm font-medium text-zinc-600"
              >
                {game.name}
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Coming Soon
                </span>
              </span>
            );
          }

          return (
            <Link
              key={game.href}
              href={game.href}
              className={`rounded-t-lg px-4 py-2 ${
                active ? "bg-zinc-900" : "hover:bg-zinc-900/50"
              }`}
            >
              {game.name === "Vibes" ? (
                <Image
                  src="/logos/vibes-logo.png"
                  alt="Vibes"
                  width={70}
                  height={31}
                  className={active ? "" : "opacity-70"}
                />
              ) : (
                <span className="text-sm font-medium text-zinc-500">{game.name}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
