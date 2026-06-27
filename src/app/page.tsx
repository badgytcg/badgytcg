import Link from "next/link";
import Image from "next/image";
import { getEffectiveCards } from "@/lib/catalog";

const FAN_CARDS = [
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/RedWizardPenguin.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/UmbrellaRod.png",
  "/cards/baron-fishpockets.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/StrikingSwordsmanPenguin.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/ChubopolisUnleashed.png",
];

const FAN_ROTATIONS = ["-rotate-12", "-rotate-6", "rotate-0", "rotate-6", "rotate-12"];
const FAN_OFFSETS = ["translate-y-3", "translate-y-1", "translate-y-0", "translate-y-1", "translate-y-3"];

const RARITY_RANK: Record<string, number> = { Epic: 0, Rare: 1, Uncommon: 2, Common: 3 };

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
              <span className="text-white">Build the Vibe.</span>
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

          <div className="relative mx-auto flex h-64 w-full max-w-sm items-center justify-center sm:h-80">
            {FAN_CARDS.map((src, i) => (
              <div
                key={src}
                className={`absolute h-56 w-40 overflow-hidden rounded-xl border-4 border-zinc-800 shadow-2xl shadow-purple-950/50 transition-transform sm:h-72 sm:w-52 ${FAN_ROTATIONS[i]} ${FAN_OFFSETS[i]}`}
                style={{ left: `${i * 13}%` }}
              >
                <Image src={src} alt="" fill sizes="200px" className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-zinc-900/60 px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Why BadgyTCG</p>
        <h2 className="mt-2 font-[var(--font-baloo)] text-2xl font-extrabold uppercase text-white sm:text-3xl">
          Everything You Need to Build a Deck
        </h2>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-3xl">🔍</div>
            <h3 className="mt-3 font-bold uppercase text-white">Browse or Build</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Filter the full singles catalog, or pick cards one by one and watch your deck&apos;s total cost add up live.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-3xl">⚡</div>
            <h3 className="mt-3 font-bold uppercase text-white">We Fill What&apos;s in Stock</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Import a deck code and we&apos;ll add everything available straight to your cart — no guessing.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="text-3xl">🎯</div>
            <h3 className="mt-3 font-bold uppercase text-white">We Hunt Down the Rest</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Missing cards land on your wishlist automatically. We track them down and follow up once they&apos;re ready.
            </p>
          </div>
        </div>
      </section>

      {trending.length > 0 && (
        <section className="bg-zinc-950 px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between">
              <h2 className="font-[var(--font-baloo)] text-2xl font-extrabold uppercase text-white sm:text-3xl">
                In Stock Now
              </h2>
              <Link href="/vibes" className="text-sm font-bold text-purple-400 hover:underline">
                View all →
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {trending.map((card) => (
                <Link
                  key={card.id}
                  href={`/vibes/cards/${card.id}`}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 ring-1 ring-purple-500/20 transition-transform hover:-translate-y-1"
                >
                  <div className="relative h-36 w-full bg-zinc-800">
                    <Image src={card.image} alt={card.name} fill sizes="160px" className="object-contain" unoptimized />
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-white">{card.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{card.rarity} · ${card.price.toFixed(2)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
