import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/app/providers";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceMono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "MetaYield · USDC Blended Vault",
  description: "Institutional-grade USDC savings vault on Base.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${spaceMono.variable} font-sans bg-bg text-text`}>
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
