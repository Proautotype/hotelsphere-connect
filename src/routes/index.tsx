import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Custard Hotels — Run Your Hotel Without The Chaos" },
      {
        name: "description",
        content:
          "Custard Hotels is the all-in-one management platform for Ghana's hotels: rooms, bookings, reception, mobile money payments, housekeeping and revenue in one place.",
      },
      { property: "og:title", content: "Custard Hotels — Run Your Hotel Without The Chaos" },
      {
        property: "og:description",
        content:
          "One platform for hotel operations, bookings, reception, payments and housekeeping. Built for hotels in Accra, Kumasi and Cape Coast.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const TICKER = [
  "ROOM 204 CHECKED IN",
  "MOMO PAYMENT GHS 480 CONFIRMED",
  "HOUSEKEEPING CLEARED FLOOR 3",
  "BOOKING #CH-2914 CONFIRMED",
  "CASH SESSION BALANCED",
  "ROOM 118 INSPECTED",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-5 pt-6 sm:px-8 lg:px-12">
        {/* Nav */}
        <nav className="flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-extrabold tracking-tighter italic sm:text-3xl">
            CUSTARD<span className="text-primary">.</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-8">
            <Link to="/auth" className="text-sm font-medium transition-colors hover:text-primary sm:text-base">
              Sign in
            </Link>
            <Link
              to="/register"
              className="ink kinetic-press shadow-hard bg-amber px-4 py-2 text-sm font-bold text-amber-foreground sm:px-6 sm:text-base"
            >
              Register your hotel
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <main className="mt-16 grid grid-cols-1 gap-12 lg:mt-24 lg:grid-cols-12 lg:items-start">
          <div className="animate-rise space-y-8 lg:col-span-7">
            <div className="ink inline-block -rotate-1 bg-primary px-4 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground sm:text-sm">
              Now serving Accra, Kumasi &amp; Cape Coast
            </div>
            <h1 className="font-display text-5xl font-extrabold uppercase leading-[0.85] tracking-tighter sm:text-6xl lg:text-7xl">
              <span className="animate-swipe block [animation-delay:60ms]">Run your hotel</span>
              <span className="animate-swipe block text-primary underline decoration-[8px] underline-offset-[10px] [animation-delay:180ms]">
                without
              </span>
              <span className="animate-swipe block [animation-delay:300ms]">the chaos.</span>
            </h1>
            <p className="max-w-xl text-lg font-medium leading-relaxed text-muted-foreground sm:text-2xl">
              The all-in-one management platform for Ghana's premier stays. Simplify reception,
              automate payments, and scale your hospitality business.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                to="/register"
                className="ink kinetic-press shadow-hard-teal bg-ink px-8 py-4 text-lg font-bold text-background sm:px-10 sm:py-5 sm:text-xl"
              >
                Get started now
              </Link>
              <Link
                to="/auth"
                className="ink px-8 py-4 text-lg font-bold transition-colors hover:bg-muted sm:px-10 sm:py-5 sm:text-xl"
              >
                Sign in to your hotel
              </Link>
            </div>
          </div>

          {/* Kinetic capability blocks */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5">
            <div className="ink kinetic-tilt shadow-hard animate-rise bg-card p-6 [animation-delay:120ms]">
              <div className="ink mb-4 size-12 bg-amber" />
              <h3 className="mb-2 text-lg font-bold uppercase leading-tight tracking-normal">Hotel operations</h3>
              <p className="text-sm text-muted-foreground">
                Room inventory, room types, availability and pricing in one dashboard.
              </p>
            </div>

            <div className="ink kinetic-tilt-right shadow-hard-teal animate-rise bg-card p-6 sm:translate-y-8 [animation-delay:200ms]">
              <div className="ink mb-4 size-12 bg-primary" />
              <h3 className="mb-2 text-lg font-bold uppercase leading-tight tracking-normal">Bookings &amp; reception</h3>
              <p className="text-sm text-muted-foreground">
                Check in, check out and settle folios for walk-ins and online stays.
              </p>
            </div>

            <div className="ink kinetic-tilt-right shadow-hard-amber animate-rise bg-card p-6 [animation-delay:280ms]">
              <div className="ink mb-4 size-12 bg-ink" />
              <h3 className="mb-2 text-lg font-bold uppercase leading-tight tracking-normal">Payments &amp; cash</h3>
              <p className="text-sm text-muted-foreground">
                Mobile money, card and cash with audited cashier sessions.
              </p>
            </div>

            <div className="ink kinetic-tilt shadow-hard animate-rise bg-ink p-6 sm:translate-y-8 [animation-delay:360ms]">
              <div className="mb-4 size-12 border-[3px] border-background bg-background" />
              <h3 className="mb-2 text-lg font-bold uppercase leading-tight tracking-normal text-background">Tenant isolation</h3>
              <p className="text-sm text-background/70">
                Every hotel's data stays private. Platform admins handle approvals.
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Live ops ticker */}
      <div className="ink mt-24 overflow-hidden border-x-0 bg-amber py-3">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
          {[...TICKER, ...TICKER, ...TICKER, ...TICKER].map((item, i) => (
            <span key={i} className="kinetic-label text-sm text-amber-foreground">
              {item} <span className="text-primary">/</span>
            </span>
          ))}
        </div>
      </div>

      <footer className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
        <p className="kinetic-label text-xs text-muted-foreground">
          © {new Date().getFullYear()} Custard Hotels — Ghana
        </p>
      </footer>
    </div>
  );
}
