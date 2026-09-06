import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bookings/")({
  head: () => ({
    meta: [
      { title: "Bookings — Custard Hotels" },
      { name: "description", content: "Manage hotel bookings and reservations." },
      { property: "og:title", content: "Bookings — Custard Hotels" },
      { property: "og:description", content: "Manage hotel bookings and reservations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingsPage,
});

async function fetchBookings(hotelId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, reference, status, check_in, check_out, total, amount_paid, guests(full_name), rooms(room_number), room_types(name)")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function BookingsPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", "list", hotelId],
    queryFn: () => fetchBookings(hotelId),
    enabled: Boolean(hotelId),
  });

  return (
    <DashboardShell title="Bookings">
      <PageHeader
        title="Bookings"
        description="All reservations, arrivals, and stays."
        actions={
          <Button asChild>
            <Link to="/bookings/$id" params={{ id: "new" }}>
              <Plus className="mr-1 size-4" /> New booking
            </Link>
          </Button>
        }
      />

      <div className="mt-6 space-y-3">
        {bookings.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No bookings yet"
            description="Create a reservation to get started."
            action={
              <Button asChild>
                <Link to="/bookings/$id" params={{ id: "new" }}>Create booking</Link>
              </Button>
            }
          />
        ) : (
          (bookings as Array<{ id: string; reference: string; status: string; check_in: string; check_out: string; total: number; amount_paid: number; guests: unknown; rooms: unknown; room_types: unknown }>).map((b) => {
            const guest = b.guests as unknown as { full_name: string } | null;
            const room = b.rooms as unknown as { room_number: string } | null;
            const roomType = b.room_types as unknown as { name: string } | null;
            const balance = Number(b.total) - Number(b.amount_paid);
            return (
              <Link key={b.id} to="/bookings/$id" params={{ id: b.id }} className="block">
                <Card className="group transition-all hover:-translate-y-0.5 hover:bg-amber hover:text-amber-foreground hover:shadow-hard">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{b.reference}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-1 text-sm opacity-80">
                        {guest?.full_name} · {roomType?.name} {room?.room_number ? `· Room ${room.room_number}` : ""}
                      </p>
                      <p className="text-xs opacity-70">{shortDate(b.check_in)} → {shortDate(b.check_out)}</p>
                    </div>
                    <div className="flex items-center gap-3 sm:text-right">
                      <div>
                        <p className="font-medium">{money(b.total, activeHotel?.currency)}</p>
                        {balance > 0.009 && <p className="text-xs font-semibold">Balance {money(balance, activeHotel?.currency)}</p>}
                        <p className="kinetic-label mt-1 text-[10px] opacity-70">Open booking</p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}
