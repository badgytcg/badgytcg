import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <AuthProvider>
          <StoreProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-purple-900/40 px-6 py-6 text-center text-xs text-zinc-500">
              Fan-made storefront, not affiliated with Orange Cap Games.
            </footer>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
