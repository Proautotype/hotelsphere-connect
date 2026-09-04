import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Guest-facing chrome for the discovery site. Kept separate from the dashboard
// shells so the discovery surface stays portable.
export function DiscoveryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-[3px] border-ink bg-sand">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link to="/" className="font-display text-2xl font-extrabold italic tracking-tighter">
            CUSTARD<span className="text-primary">.</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium sm:gap-7">
            <Link to="/discover" className="transition-colors hover:text-primary">
              Find a hotel
            </Link>
            <Link to="/auth" className="hidden transition-colors hover:text-primary sm:inline">
              Sign in
            </Link>
            <Link to="/register" className="ink kinetic-press shadow-hard bg-amber px-4 py-2 text-sm font-bold text-amber-foreground">
              List your hotel
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-8 sm:px-8 lg:px-12">{children}</main>

      <footer className="border-t-[3px] border-ink bg-ink py-10 text-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <p className="font-display text-xl font-extrabold italic tracking-tighter">CUSTARD HOTELS.</p>
          <p className="text-sm opacity-80">Stay well in Ghana · Pay with Mobile Money or at the desk</p>
        </div>
      </footer>
    </div>
  );
}
