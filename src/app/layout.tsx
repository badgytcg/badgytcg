import type { Metadata } from "next";
import { Geist, Geist_Mono, Baloo_2 } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";
import ShippingNoticeBanner from "@/components/ShippingNoticeBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Bubbly rounded font for bold marketing headlines (homepage hero, etc).
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "BadgyTCG — Vibes TCG Singles & Decks",
  description: "Buy Vibes TCG singles, or import a deck code to build the full deck.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set the theme before first paint so there's no flash of the wrong mode.
  // Default is the OS preference; an explicit choice is remembered in
  // localStorage under "theme" (light | dark | system).
  const themeScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',dark?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

  // Light mode = a faithful counterpart to the dark design: flip the neutral
  // (zinc) ramp, darken accent shades used as text for AA contrast, and turn
  // translucent dark badge backgrounds into light tints. Brand purple for
  // solid buttons (500/600/700) is left alone. Kept as raw CSS (not in
  // globals.css, which Tailwind/Lightning CSS strips [data-theme] blocks from).
  const lightThemeCss = `:root[data-theme="light"]{--background:#fafafa;--foreground:#18181b;--color-zinc-50:#09090b;--color-zinc-100:#18181b;--color-zinc-200:#27272a;--color-zinc-300:#3f3f46;--color-zinc-400:#52525b;--color-zinc-500:#71717a;--color-zinc-600:#a1a1aa;--color-zinc-700:#d4d4d8;--color-zinc-800:#e4e4e7;--color-zinc-900:#f4f4f5;--color-zinc-950:#fafafa;--color-purple-200:#6b21a8;--color-purple-300:#7e22ce;--color-purple-400:#9333ea;--color-green-300:#15803d;--color-green-400:#15803d;--color-green-500:#15803d;--color-red-200:#b91c1c;--color-red-300:#b91c1c;--color-red-400:#dc2626;--color-red-500:#dc2626;--color-yellow-300:#a16207;--color-yellow-400:#a16207;--color-amber-200:#b45309;--color-amber-300:#b45309;--color-amber-400:#b45309;--color-blue-300:#1d4ed8;--color-blue-400:#2563eb;--color-sky-300:#0369a1;--color-sky-400:#0369a1;--color-indigo-300:#4338ca;--color-teal-300:#0f766e;--color-pink-400:#be185d;--color-purple-900:#f3e8ff;--color-purple-950:#faf5ff;--color-green-900:#dcfce7;--color-green-950:#f0fdf4;--color-red-900:#fee2e2;--color-red-950:#fef2f2;--color-blue-900:#dbeafe;--color-sky-900:#e0f2fe;--color-indigo-900:#e0e7ff;--color-teal-900:#ccfbf1;}`;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style dangerouslySetInnerHTML={{ __html: lightThemeCss }} />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <AuthProvider>
          <StoreProvider>
            <div className="print:hidden">
              <Navbar />
              <ShippingNoticeBanner />
            </div>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-purple-900/40 px-6 py-6 text-center text-xs text-zinc-500 print:hidden">
              <a href="/support" className="text-purple-400 hover:underline">Contact &amp; Support</a>
              <span className="mx-2">·</span>
              Fan-made storefront, not affiliated with Orange Cap Games.
            </footer>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
