import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "EarnGrid | Curated USDC Yield",
  description: "Deposit USDC into a curated ERC-4626 meta-vault on Base and track allocations across strategies."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-transparent">
        <Providers>
          <div className="min-h-screen px-4 py-6 sm:px-8">
            <header className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-soft backdrop-blur">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">EarnGrid</p>
                <h1 className="text-xl font-semibold text-ink">Blended USDC yield on Base</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-medium text-teal">Base Mainnet</span>
              </div>
            </header>
            <main className="pt-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
