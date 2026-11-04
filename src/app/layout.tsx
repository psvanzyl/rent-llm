import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: {
    default: "Broomy — rent a Qwen 3.8 model by the month",
    template: "%s · Broomy",
  },
  description: "Rent European-hosted Qwen 3.8 access via an OpenAI-compatible API. €20 or €50 per month, unlimited tokens.",
  metadataBase: new URL("https://broomy.laserraptor.eu"),
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/broom-icon.png", type: "image/png" }], apple: "/apple-touch-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
            <a href="/" className="flex items-center gap-3 group">
              <img src="/broom-icon.png" alt="" className="h-8 w-8 rounded-lg" />
              <span className="font-display text-lg font-semibold tracking-tight">Broomy</span>
            </a>
            <nav className="hidden sm:flex items-center gap-1 text-sm text-zinc-400">
              <a href="/" className="rounded-md px-3 py-2 hover:text-white hover:bg-white/5 transition">Pricing</a>
              <a href="/docs" className="rounded-md px-3 py-2 hover:text-white hover:bg-white/5 transition">Docs</a>
              <a href="/dashboard" className="rounded-md px-3 py-2 hover:text-white hover:bg-white/5 transition">Dashboard</a>
            </nav>
            <a href="/login" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition">
              Sign in
            </a>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/5 py-10">
          <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <p>© 2026 Broomy · European-hosted Qwen 3.8 · OpenAI-compatible</p>
            <div className="flex gap-6">
              <a href="/docs" className="hover:text-zinc-300 transition">Docs</a>
              <a href="/dashboard" className="hover:text-zinc-300 transition">Dashboard</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
