import type { Metadata } from "next";
import { Geist, Geist_Mono, Baloo_2 } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/context/StoreContext";
import Navbar from "@/components/Navbar";
import AuthProvider from "@/components/AuthProvider";

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
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <AuthProvider>
          <StoreProvider>
            <div className="print:hidden">
              <Navbar />
            </div>
            <main className="flex-1">{children}</main>
            <footer className="border-t border-purple-900/40 px-6 py-6 text-center text-xs text-zinc-500 print:hidden">
              Fan-made storefront, not affiliated with Orange Cap Games.
            </footer>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
