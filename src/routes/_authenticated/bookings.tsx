import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CalendarDays, Plus } from "lucide-react";
import { money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bookings")({
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
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["bookings", "list"],
      queryFn: async () => fetchBookings(),
    });
  },
  component: BookingsPage,
});

async function fetchBookings() {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, reference, status, check_in, check_out, total, amount_paid, guests(full_name), rooms(room_number), room_types(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function BookingsPage() {
  const { activeHotel } = useAuth();
  const { data: bookings } = useSuspenseQuery({ queryKey: ["bookings", "list"], queryFn: fetchBookings });

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
          bookings.map((b) => {
            const guest = b.guests as unknown as { full_name: string } | null;
            const room = b.rooms as unknown as { room_number: string } | null;
            const roomType = b.room_types as unknown as { name: string } | null;
            const balance = Number(b.total) - Number(b.amount_paid);
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to="/bookings/$id" params={{ id: b.id }} className="font-display font-semibold text-foreground hover:text-primary">
                        {b.reference}
                      </Link>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {guest?.full_name} · {roomType?.name} {room?.room_number ? `· Room ${room.room_number}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{shortDate(b.check_in)} → {shortDate(b.check_out)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{money(b.total, activeHotel?.currency)}</p>
                    {balance > 0.009 && <p className="text-xs text-destructive">Balance {money(balance, activeHotel?.currency)}</p>}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}
