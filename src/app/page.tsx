import Link from "next/link";

export default function Home() {
  return (
    <div>
      <section
        className="relative overflow-hidden bg-zinc-950 bg-cover bg-top bg-no-repeat px-6 py-24 text-center sm:py-32"
        style={{ backgroundImage: "url(/backgrounds/synthwave-hero.webp)" }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-zinc-950/70 to-zinc-950" />
        <div className="relative mx-auto max-w-4xl">
          <h1 className="text-5xl font-extrabold uppercase tracking-wider sm:text-6xl">
            <span className="bg-gradient-to-r from-yellow-300 via-pink-500 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(236,72,153,0.45)]">
              Badgy
            </span>
            <span className="text-white">TCG</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-zinc-300">
            Singles and prebuilt decks for trading card games, starting with
            Pudgy Penguins&apos; Vibes TCG. Pick a game below to browse.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link href="/vibes" className="rounded-full bg-purple-600 px-5 py-2 font-medium text-white hover:bg-purple-500">
              Shop Vibes TCG
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-16">
        <section className="grid gap-8 sm:grid-cols-3">
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
    </div>
  );
}
