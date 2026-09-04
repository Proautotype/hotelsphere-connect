import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Building2, CalendarDays, CreditCard, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Custard Hotels — Hotel Management & Operations" },
      { name: "description", content: "Run your hotel smarter with Custard Hotels. Manage rooms, bookings, payments, housekeeping, and revenue in one place." },
      { property: "og:title", content: "Custard Hotels — Hotel Management & Operations" },
      { property: "og:description", content: "Run your hotel smarter with Custard Hotels. Manage rooms, bookings, payments, housekeeping, and revenue in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
              C
            </span>
            <span className="font-display text-xl font-semibold text-foreground">Custard Hotels</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Register your hotel</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
              Run your hotel <span className="text-primary">without the chaos.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              Custard Hotels gives hotel owners and staff one place to manage rooms, bookings,
              payments, housekeeping, and revenue — from the front desk to the platform admin office.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">Register your hotel</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/auth">Sign in to your hotel</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={Building2}
              title="Hotel operations"
              description="Room inventory, room types, availability, and pricing all in one dashboard."
            />
            <FeatureCard
              icon={CalendarDays}
              title="Bookings & reception"
              description="Create, edit, check in, and check out guests with automated folios and balances."
            />
            <FeatureCard
              icon={CreditCard}
              title="Payments & cash"
              description="Take cash, mobile money, and card payments with Paystack and audited cash sessions."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Tenant isolation"
              description="Every hotel's data is private. Platform admins manage approvals and oversight."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Custard Hotels. Phase 1 preview.
          </p>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
