import Link from "next/link";
import Image from "next/image";

const FAN_CARDS = [
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/RedWizardPenguin.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/UmbrellaRod.png",
  "/cards/baron-fishpockets.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/StrikingSwordsmanPenguin.png",
  "https://ocg-card-catalog.s3.us-west-2.amazonaws.com/Spoiler_Previews/ChubopolisUnleashed.png",
];

const FAN_ROTATIONS = ["-rotate-12", "-rotate-6", "rotate-0", "rotate-6", "rotate-12"];
const FAN_OFFSETS = ["translate-y-3", "translate-y-1", "translate-y-0", "translate-y-1", "translate-y-3"];

export default function Home() {
  return (
    <div>
      <section className="relative overflow-hidden bg-[#5B6EF5]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 sm:py-28 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h1 className="font-[var(--font-baloo)] text-4xl font-extrabold uppercase leading-tight text-white sm:text-5xl">
              Browse. Buy.
              <br />
              Build the Vibe.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-indigo-100 lg:mx-0">
              Singles, decks, foils, and graded cards for Pudgy Penguins&apos;
              Vibes TCG — starting with Vibes, more games on the way.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                href="/vibes"
                className="rounded-full bg-white px-6 py-3 font-bold text-[#5B6EF5] shadow-lg hover:bg-indigo-50"
              >
                Shop Vibes TCG
              </Link>
              <Link
                href="/vibes/deck-import"
                className="rounded-full border-2 border-white px-6 py-3 font-bold text-white hover:bg-white/10"
              >
                Import a Deck
              </Link>
            </div>
          </div>

          <div className="relative mx-auto flex h-64 w-full max-w-sm items-center justify-center sm:h-80">
            {FAN_CARDS.map((src, i) => (
              <div
                key={src}
                className={`absolute h-56 w-40 overflow-hidden rounded-xl border-4 border-white shadow-2xl transition-transform sm:h-72 sm:w-52 ${FAN_ROTATIONS[i]} ${FAN_OFFSETS[i]}`}
                style={{ left: `${i * 13}%` }}
              >
                <Image src={src} alt="" fill sizes="200px" className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#4A5CE0] px-6 py-16 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">Why BadgyTCG</p>
        <h2 className="mt-2 font-[var(--font-baloo)] text-2xl font-extrabold uppercase text-white sm:text-3xl">
          Everything You Need to Build a Deck
        </h2>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/10 p-6">
            <div className="text-3xl">🔍</div>
            <h3 className="mt-3 font-bold uppercase text-white">Browse or Build</h3>
            <p className="mt-2 text-sm text-indigo-100">
              Filter the full singles catalog, or pick cards one by one and watch your deck&apos;s total cost add up live.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-6">
            <div className="text-3xl">⚡</div>
            <h3 className="mt-3 font-bold uppercase text-white">We Fill What&apos;s in Stock</h3>
            <p className="mt-2 text-sm text-indigo-100">
              Import a deck code and we&apos;ll add everything available straight to your cart — no guessing.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-6">
            <div className="text-3xl">🎯</div>
            <h3 className="mt-3 font-bold uppercase text-white">We Hunt Down the Rest</h3>
            <p className="mt-2 text-sm text-indigo-100">
              Missing cards land on your wishlist automatically. We track them down and follow up once they&apos;re ready.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
