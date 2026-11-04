import Link from "next/link";
import Image from "next/image";
import { getEffectiveCards } from "@/lib/catalog";
import DeckShowcase from "@/components/DeckShowcase";
import CardFan from "@/components/CardFan";

const RARITY_RANK: Record<string, number> = { Epic: 0, Rare: 1, Uncommon: 2, Common: 3 };

const RARITY_CHIP: Record<string, string> = {
  Common: "border-zinc-600 bg-zinc-700/40 text-zinc-300",
  Uncommon: "border-green-600 bg-green-900/40 text-green-300",
  Rare: "border-blue-500 bg-blue-900/40 text-blue-300",
  Epic: "border-purple-500 bg-purple-900/40 text-purple-300",
};

// Dynamic, not statically generated, so "In Stock Now" reflects live
// admin-edited inventory instead of whatever was true at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const cards = await getEffectiveCards();
  const trending = cards
    .filter((c) => c.stock > 0)
    .sort((a, b) => (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9))
    .slice(0, 10);

  return (
    <div className="bg-zinc-950">
      <section className="relative overflow-hidden bg-gradient-to-b from-purple-950 via-zinc-950 to-zinc-950">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:py-28 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h1 className="font-[var(--font-baloo)] text-4xl font-extrabold uppercase leading-tight sm:text-5xl">
              <span className="bg-gradient-to-r from-yellow-300 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(236,72,153,0.35)]">
                Browse. Buy.
              </span>
              <br />
              <span className="text-zinc-100">Build the Vibe.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-zinc-300 lg:mx-0">
              Singles, decks, foils, and graded cards for Pudgy Penguins&apos;
              Vibes TCG — starting with Vibes, more games on the way.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                href="/vibes"
                className="rounded-full bg-purple-600 px-6 py-3 font-bold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500"
              >
                Shop Vibes TCG
              </Link>
              <Link
                href="/vibes/deck-import"
                className="rounded-full border-2 border-zinc-700 px-6 py-3 font-bold text-zinc-200 hover:border-purple-500 hover:text-purple-300"
              >
                Import a Deck
              </Link>
            </div>
          </div>

          <CardFan />
        </div>
      </section>

      <section className="bg-zinc-900/60 px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Why BadgyTCG</p>
        <h2 className="mt-2 font-[var(--font-baloo)] text-2xl font-extrabold uppercase text-zinc-100 sm:text-3xl">
          Everything You Need to Build a Deck
        </h2>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-3xl">🔍</div>
            <h3 className="mt-3 font-bold uppercase text-zinc-100">Browse or Build</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Filter the full singles catalog, or pick cards one by one and watch your deck&apos;s total cost add up live.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-3xl">⚡</div>
            <h3 className="mt-3 font-bold uppercase text-zinc-100">We Fill What&apos;s in Stock</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Import a deck code and we&apos;ll add everything available straight to your cart — no guessing.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-3xl">🎯</div>
            <h3 className="mt-3 font-bold uppercase text-zinc-100">We Hunt Down the Rest</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Missing cards land on your wishlist automatically. We track them down and follow up once they&apos;re ready.
            </p>
          </div>
        </div>
      </section>

      <DeckShowcase catalog={cards} />

      {trending.length > 0 && (
        <section className="bg-zinc-950 px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-baloo)] text-2xl font-extrabold uppercase text-zinc-100 sm:text-3xl">
                In Stock Now
              </h2>
              <Link href="/vibes" className="text-sm font-bold text-purple-400 hover:underline">
                View all →
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {trending.map((card) => {
                const low = card.stock > 0 && card.stock <= 5;
                return (
                  <Link
                    key={card.id}
                    href={`/vibes/cards/${card.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 ring-1 ring-purple-500/20 p-3 transition duration-200 hover:-translate-y-1 hover:border-zinc-600 hover:shadow-xl hover:shadow-black/40"
                  >
                    <div className="relative mb-3 overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950" style={{ aspectRatio: "3/4" }}>
                      <Image
                        src={card.image}
                        alt={card.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 200px"
                        style={{ transform: "scale(1.04)" }}
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.07]"
                        unoptimized
                      />
                    </div>
                    <p className="truncate text-sm font-semibold text-zinc-100" title={card.name}>{card.name}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="truncate text-[11px] text-zinc-500">{card.set}</span>
                      <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${RARITY_CHIP[card.rarity] ?? "border-zinc-700 bg-zinc-800/50 text-zinc-300"}`}>{card.rarity}</span>
                    </div>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-lg font-bold tabular-nums text-purple-300">${card.price.toFixed(2)}</span>
                      <span className={`text-[11px] font-medium ${low ? "text-amber-400" : "text-green-400"}`}>{low ? `Low: ${card.stock}` : `${card.stock} in stock`}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
