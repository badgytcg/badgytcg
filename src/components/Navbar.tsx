"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useStore } from "@/context/StoreContext";

// Add new games here as you expand beyond Vibes.
const GAMES = [{ name: "Vibes", href: "/vibes" }];

export default function Navbar() {
  const { cartCount, wishlist } = useStore();
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-10 border-b border-purple-900/40 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-purple-400">Badgy</span>
          <span className="text-sm font-medium text-zinc-400">TCG</span>
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-300">
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
      <nav className="mx-auto flex max-w-6xl gap-1 px-6">
        {GAMES.map((game) => {
          const active = pathname?.startsWith(game.href);
          return (
            <Link
              key={game.href}
              href={game.href}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium ${
                active
                  ? "bg-zinc-900 text-purple-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {game.name}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
