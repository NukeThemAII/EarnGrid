"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WalletButton } from "@/components/wallet-button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/vault", label: "Vault" },
  { href: "/strategies", label: "Strategies" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header className="bg-grid border-b border-border/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">MetaYield</p>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">USDC Blended Vault</h1>
            <Badge variant="accent">Base</Badge>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "pb-1 transition hover:text-text",
                  isActive && "border-b border-accent text-text"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <WalletButton size="sm" />
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <WalletButton size="sm" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
          >
            {menuOpen ? "Close" : "Menu"}
          </Button>
        </div>
      </div>
      {menuOpen ? (
        <div className="border-t border-border/60 bg-surface/90 backdrop-blur md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-4 text-sm text-muted">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "transition hover:text-text",
                    isActive && "text-text"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
