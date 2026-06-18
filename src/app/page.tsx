import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <section className="text-center">
        <h1 className="text-4xl font-bold text-white">BadgyTCG</h1>
        <p className="mx-auto mt-3 max-w-xl text-zinc-300">
          Singles and prebuilt decks for trading card games, starting with
          Pudgy Penguins&apos; Vibes TCG. Pick a game below to browse.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/vibes" className="rounded-full bg-purple-600 px-5 py-2 font-medium text-white hover:bg-purple-500">
            Shop Vibes TCG
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-8 sm:grid-cols-3">
        <div>
          <h2 className="font-semibold text-zinc-100">1. Browse or import a deck</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Buy singles one at a time, or paste a deck code from the game&apos;s
            deck builder to grab a whole deck at once.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-zinc-100">2. We fill what&apos;s in stock</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Anything available goes straight into your cart at a flat deck
            price. No guessing what&apos;s actually available.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-zinc-100">3. We hunt down the rest</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Missing cards land on your wishlist automatically. We track those
            down and follow up once they&apos;re ready.
          </p>
        </div>
      </section>
    </div>
  );
}
