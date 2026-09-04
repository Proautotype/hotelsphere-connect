import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, CalendarDays, CreditCard } from "lucide-react";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_admin/admin")({
  head: () => ({
    meta: [
      { title: "Platform Overview — Custard Hotels Admin" },
      { name: "description", content: "Platform administration overview for Custard Hotels." },
      { property: "og:title", content: "Platform Overview — Custard Hotels Admin" },
      { property: "og:description", content: "Platform administration overview for Custard Hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["admin", "overview"],
      queryFn: async () => {
        const [hotels, users, bookings, payments] = await Promise.all([
          supabase.from("hotels").select("status", { count: "exact", head: true }),
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase.from("bookings").select("id", { count: "exact", head: true }),
          supabase.from("payments").select("amount", { count: "exact" }).eq("status", "successful"),
        ]);
        const revenue = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
        return {
          hotels: hotels.count ?? 0,
          users: users.count ?? 0,
          bookings: bookings.count ?? 0,
          revenue,
        };
      },
    });
  },
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const { data } = useSuspenseQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const [hotels, users, bookings, payments] = await Promise.all([
        supabase.from("hotels").select("status", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("amount", { count: "exact" }).eq("status", "successful"),
      ]);
      const revenue = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
      return {
        hotels: hotels.count ?? 0,
        users: users.count ?? 0,
        bookings: bookings.count ?? 0,
        revenue,
      };
    },
  });

  return (
    <AdminShell title="Platform Overview">
      <PageHeader title="Platform overview" description="High-level metrics and recent activity across all hotels." />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hotels" value={data.hotels} icon={Building2} tone="primary" />
        <StatCard label="Users" value={data.users} icon={Users} tone="accent" />
        <StatCard label="Bookings" value={data.bookings} icon={CalendarDays} tone="warning" />
        <StatCard label="Revenue" value={money(data.revenue, "GHS")} icon={CreditCard} tone="success" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Quick actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/hotels" className="block rounded-lg border border-border p-4 hover:bg-muted">
              <p className="font-medium text-foreground">Review hotel registrations</p>
              <p className="text-sm text-muted-foreground">Approve, suspend, or reject pending hotels.</p>
            </Link>
            <Link to="/admin/users" className="block rounded-lg border border-border p-4 hover:bg-muted">
              <p className="font-medium text-foreground">Manage users</p>
              <p className="text-sm text-muted-foreground">View user accounts and platform roles.</p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
