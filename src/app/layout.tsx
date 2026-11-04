import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  icons: { icon: "/broom-icon.svg", apple: "/broom-icon.svg" },
  title: {
    default: "RentLLM — rent Qwen 3.8 by the token",
    template: "%s · RentLLM",
  },
  description: "Rent access to a Qwen 3.8 model via an OpenAI-compatible API. Sign in with Google, get an API key, start calling.",
  metadataBase: new URL("https://broomy.laserraptor.eu"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-gray-800 bg-black/60 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
            <Link href="/" className="font-semibold tracking-tight text-lg">
              Rent<span className="text-cyan-400">LLM</span>
            </Link>
            <nav className="ml-4 hidden sm:flex items-center gap-1 text-sm text-gray-400">
              <Link href="/" className="rounded px-2.5 py-1.5 hover:text-white hover:bg-gray-800">Home</Link>
              <Link href="/docs" className="rounded px-2.5 py-1.5 hover:text-white hover:bg-gray-800">Docs</Link>
              <Link href="/dashboard" className="rounded px-2.5 py-1.5 hover:text-white hover:bg-gray-800">Dashboard</Link>
            </nav>
            <div className="ml-auto">
              <Link href="/login" className="rounded-md bg-cyan-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-cyan-400">
                Sign in with Google
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-gray-800 py-4 text-center text-xs text-gray-500">
          RentLLM · Qwen 3.8 · OpenAI-compatible API
        </footer>
      </body>
    </html>
  );
}
