import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { confirmBooking, checkInBooking, checkOutBooking } from "@/lib/bookings.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DoorOpen, Search } from "lucide-react";
import { money, shortDate, today } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/reception")({
  head: () => ({
    meta: [
      { title: "Reception — Custard Hotels" },
      { name: "description", content: "Check guests in and out at reception." },
      { property: "og:title", content: "Reception — Custard Hotels" },
      { property: "og:description", content: "Check guests in and out at reception." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["reception", "today"],
      queryFn: async () => fetchTodayBookings(),
    });
  },
  component: ReceptionPage,
});

async function fetchTodayBookings() {
  const todayStr = today();
  const { data, error } = await supabase
    .from("bookings")
    .select("id, reference, status, check_in, check_out, total, amount_paid, guests(full_name), rooms(room_number)")
    .or(`check_in.eq.${todayStr},check_out.eq.${todayStr},status.eq.checked_in`)
    .not("status", "in", "(cancelled,no_show)")
    .order("check_in", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function ReceptionPage() {
  const { activeHotel } = useAuth();
  const { data: bookings, refetch } = useSuspenseQuery({ queryKey: ["reception", "today"], queryFn: fetchTodayBookings });
  const [query, setQuery] = useState("");
  const confirm = useServerFn(confirmBooking);
  const checkIn = useServerFn(checkInBooking);
  const checkOut = useServerFn(checkOutBooking);

  const filtered = (bookings as Array<{ id: string; reference: string; status: string; total: number; amount_paid: number; check_in: string; check_out: string; guests: unknown; rooms: unknown }>).filter((b) => {
    const q = query.toLowerCase();
    const guest = b.guests as unknown as { full_name: string } | null;
    return (
      b.reference.toLowerCase().includes(q) ||
      guest?.full_name.toLowerCase().includes(q) ||
      String(b.rooms).includes(q)
    );
  });

  const runConfirm = async (id: string) => {
    try {
      await confirm({ data: { bookingId: id } });
      toast.success("Booking confirmed");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirmation failed");
    }
  };

  const runCheckIn = async (id: string) => {
    try {
      await checkIn({ data: { bookingId: id } });
      toast.success("Guest checked in");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    }
  };

  const runCheckOut = async (id: string) => {
    try {
      await checkOut({ data: { bookingId: id } });
      toast.success("Guest checked out");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-out failed");
    }
  };

  return (
    <DashboardShell title="Reception">
      <PageHeader title="Reception" description="Check guests in and out today." />

      <div className="mt-6 relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by reference, guest name, or room number"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No bookings found.</CardContent></Card>
        ) : (
          (filtered as Array<{ id: string; reference: string; status: string; total: number; amount_paid: number; check_in: string; check_out: string; guests: unknown; rooms: unknown }>).map((b) => {
            const guest = b.guests as unknown as { full_name: string } | null;
            const room = b.rooms as unknown as { room_number: string } | null;
            const balance = Number(b.total) - Number(b.amount_paid);
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold text-foreground">{b.reference}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{guest?.full_name} · Room {room?.room_number}</p>
                    <p className="text-xs text-muted-foreground">{shortDate(b.check_in)} → {shortDate(b.check_out)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-medium text-foreground">{money(b.total, activeHotel?.currency)}</p>
                    {balance > 0.009 && <p className="text-xs text-destructive">Balance {money(balance, activeHotel?.currency)}</p>}
                    <div className="flex gap-2">
                      {b.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => runConfirm(b.id)}>
                          Confirm
                        </Button>
                      )}
                      {b.status === "confirmed" && <Button size="sm" onClick={() => runCheckIn(b.id)}><DoorOpen className="mr-1 size-4" /> Check in</Button>}
                      {b.status === "checked_in" && <Button size="sm" variant="outline" onClick={() => runCheckOut(b.id)}>Check out</Button>}
                    </div>
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
