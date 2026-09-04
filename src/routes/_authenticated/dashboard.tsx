import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  DoorOpen,
  BedDouble,
  CreditCard,
  ArrowRight,
  Building2,
} from "lucide-react";
import { money, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Custard Hotels" },
      { name: "description", content: "Hotel dashboard for rooms, bookings, and revenue." },
      { property: "og:title", content: "Dashboard — Custard Hotels" },
      { property: "og:description", content: "Hotel dashboard for rooms, bookings, and revenue." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["dashboard", "stats"],
      queryFn: async () => fetchDashboardStats(),
    });
  },
  component: DashboardPage,
});

async function fetchDashboardStats() {
  const todayStr = today();
  const startOfMonth = `${todayStr.slice(0, 7)}-01`;

  const [checkIns, checkOuts, inHouse, rooms, payments, upcoming, outstanding, monthly] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("check_in", todayStr).not("status", "in", "(cancelled,no_show,checked_out)"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("check_out", todayStr).eq("status", "checked_in"),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "checked_in"),
    supabase.from("rooms").select("status", { count: "exact" }),
    supabase.from("payments").select("amount", { count: "exact" }).eq("status", "successful").gte("created_at", todayStr),
    supabase.from("bookings").select("id, reference, check_in, check_out, guests(full_name), rooms(room_number), status").gte("check_in", todayStr).order("check_in", { ascending: true }).limit(5),
    supabase.from("bookings").select("total, amount_paid").not("status", "in", "(cancelled,checked_out)"),
    supabase.from("payments").select("amount", { count: "exact" }).eq("status", "successful").gte("created_at", startOfMonth),
  ]);

  const roomCounts = (rooms.data ?? []).reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const balance = (outstanding.data ?? []).reduce((sum, b) => sum + Math.max(0, Number(b.total) - Number(b.amount_paid)), 0);
  const todayRevenue = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const monthlyRevenue = (monthly.data ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);

  return {
    checkIns: checkIns.count ?? 0,
    checkOuts: checkOuts.count ?? 0,
    inHouse: inHouse.count ?? 0,
    totalRooms: rooms.count ?? 0,
    available: roomCounts["available"] ?? 0,
    occupied: roomCounts["occupied"] ?? 0,
    cleaning: roomCounts["cleaning"] ?? 0,
    maintenance: roomCounts["maintenance"] ?? 0,
    todayRevenue,
    monthlyRevenue,
    outstanding: balance,
    upcoming: upcoming.data ?? [],
  };
}

function DashboardPage() {
  const { activeHotel, isPlatformAdmin, hotels } = useAuth();
  const { data: stats } = useSuspenseQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  if (!activeHotel) {
    return (
      <DashboardShell title="Dashboard">
        <PageHeader
          title="No hotel selected"
          description="Register your hotel or ask an owner to invite you to one."
          actions={
            <Button asChild>
              <Link to="/register">Register your hotel</Link>
            </Button>
          }
        />
        {isPlatformAdmin && (
          <Button className="mt-6" variant="outline" asChild>
            <Link to="/admin">Go to platform admin</Link>
          </Button>
        )}
      </DashboardShell>
    );
  }

  const occupancy = stats.totalRooms ? Math.round(((stats.occupied / stats.totalRooms) * 100)) : 0;

  return (
    <DashboardShell title="Dashboard">
      <PageHeader
        title={activeHotel.name}
        description={activeHotel.onboarding_completed ? "Hotel operations overview" : "Finish onboarding to start taking bookings."}
        actions={
          <Button asChild>
            <Link to="/bookings">New booking</Link>
          </Button>
        }
      />

      {!activeHotel.onboarding_completed && (
        <Card className="mt-4 border-amber/30 bg-amber/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium text-foreground">Onboarding in progress</p>
              <p className="text-sm text-muted-foreground">Complete room types, rooms, and payment methods to go live.</p>
            </div>
            <Button size="sm" asChild>
              <Link to="/onboarding">Continue onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Check-ins today" value={stats.checkIns} icon={DoorOpen} tone="primary" />
        <StatCard label="Check-outs today" value={stats.checkOuts} icon={CalendarDays} tone="warning" />
        <StatCard label="In-house guests" value={stats.inHouse} icon={BedDouble} tone="accent" />
        <StatCard label="Occupancy" value={`${occupancy}%`} icon={Building2} tone="success" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available rooms" value={stats.available} icon={BedDouble} tone="success" />
        <StatCard label="Cleaning" value={stats.cleaning} icon={BedDouble} tone="warning" />
        <StatCard label="Maintenance" value={stats.maintenance} icon={BedDouble} tone="destructive" />
        <StatCard label="Outstanding balance" value={money(stats.outstanding, activeHotel.currency)} icon={CreditCard} tone="destructive" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming arrivals & stays</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/bookings">View all <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.upcoming.length === 0 ? (
              <EmptyState title="No upcoming bookings" description="Create a booking to see it here." />
            ) : (
              <div className="space-y-3">
                {stats.upcoming.map((b) => {
                  const guest = b.guests as unknown as { full_name: string } | null;
                  const room = b.rooms as unknown as { room_number: string } | null;
                  return (
                    <div key={b.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div>
                        <p className="font-medium text-foreground">{b.reference}</p>
                        <p className="text-sm text-muted-foreground">{guest?.full_name} · Room {room?.room_number}</p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={b.status} />
                        <p className="mt-1 text-xs text-muted-foreground">{shortDate(b.check_in)} → {shortDate(b.check_out)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Revenue</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-semibold text-foreground">{money(stats.todayRevenue, activeHotel.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This month</p>
              <p className="text-2xl font-semibold text-foreground">{money(stats.monthlyRevenue, activeHotel.currency)}</p>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/payments">View payments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
