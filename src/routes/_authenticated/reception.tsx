import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  confirmBooking,
  checkInBooking,
  checkInOccupancy,
  checkOutOccupancy,
} from "@/lib/bookings.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, DoorOpen, LogOut, Search, Users } from "lucide-react";
import { money, stayRange, today } from "@/lib/format";
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
  component: ReceptionPage,
});

interface OccupantRow {
  id: string;
  status: string;
  bed_number: string | null;
  guests: { full_name: string } | null;
}

interface ReceptionRow {
  id: string;
  reference: string;
  status: string;
  total: number;
  amount_paid: number;
  check_in: string;
  /** null on a long-term stay: no agreed departure date. */
  check_out: string | null;
  guests: { full_name: string } | null;
  rooms: { room_number: string } | null;
  occupancies: OccupantRow[];
}

async function fetchTodayBookings(hotelId: string) {
  const todayStr = today();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, status, check_in, check_out, total, amount_paid, guests(full_name), rooms(room_number), occupancies(id, status, bed_number, guests(full_name))",
    )
    .eq("hotel_id", hotelId)
    .or(`check_in.eq.${todayStr},check_out.eq.${todayStr},status.eq.checked_in`)
    .not("status", "in", "(cancelled,no_show)")
    .order("check_in", { ascending: true })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ReceptionRow[];
}

function ReceptionPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const { data: bookings = [], refetch } = useQuery({
    queryKey: ["reception", "today", hotelId],
    queryFn: () => fetchTodayBookings(hotelId),
    enabled: Boolean(hotelId),
  });
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const confirm = useServerFn(confirmBooking);
  const checkIn = useServerFn(checkInBooking);
  const occCheckIn = useServerFn(checkInOccupancy);
  const occCheckOut = useServerFn(checkOutOccupancy);

  const filtered = bookings.filter((b) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      b.reference.toLowerCase().includes(q) ||
      (b.guests?.full_name.toLowerCase().includes(q) ?? false) ||
      (b.rooms?.room_number.toLowerCase().includes(q) ?? false) ||
      b.occupancies.some((o) => o.guests?.full_name.toLowerCase().includes(q))
    );
  });

  const runConfirm = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await confirm({ data: { bookingId: id } });
      toast.success("Booking confirmed");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirmation failed");
    } finally {
      setBusyId(null);
    }
  };

  const runCheckIn = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await checkIn({ data: { bookingId: id } });
      toast.success("Guest checked in");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setBusyId(null);
    }
  };

  /** Dorm beds come and go one at a time, so each occupant moves on their own. */
  const runOccupant = async (occupancyId: string, direction: "in" | "out") => {
    if (busyId) return;
    setBusyId(occupancyId);
    try {
      if (direction === "in") await occCheckIn({ data: { occupancyId } });
      else await occCheckOut({ data: { occupancyId } });
      toast.success(direction === "in" ? "Occupant checked in" : "Occupant checked out");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update this occupant");
    } finally {
      setBusyId(null);
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
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No bookings found.
            </CardContent>
          </Card>
        ) : (
          filtered.map((b) => {
            const guest = b.guests;
            const room = b.rooms;
            const balance = Number(b.total) - Number(b.amount_paid);
            // A single occupant is already named above; a dorm needs the list.
            const occupants = b.occupancies.length > 1 ? b.occupancies : [];
            return (
              <Card key={b.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/bookings/$id"
                        params={{ id: b.id }}
                        className="font-display font-semibold text-foreground underline decoration-2 underline-offset-4"
                      >
                        {b.reference}
                      </Link>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {guest?.full_name}
                      {room?.room_number ? (
                        <>
                          {" · "}
                          <Link to="/rooms" className="underline underline-offset-2">
                            Room {room.room_number}
                          </Link>
                        </>
                      ) : (
                        " · No room assigned"
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stayRange(b.check_in, b.check_out)}
                    </p>
                    {occupants.length > 0 ? (
                      <div className="mt-3 space-y-1">
                        <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
                          <Users className="size-3.5" /> {occupants.length} occupants
                        </p>
                        {occupants.map((o) => (
                          <div
                            key={o.id}
                            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                          >
                            <span className="text-foreground">
                              {o.guests?.full_name ?? "Occupant"}
                            </span>
                            {o.bed_number ? <span>Bed {o.bed_number}</span> : null}
                            <StatusBadge status={o.status} />
                            {o.status === "reserved" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                disabled={busyId !== null}
                                onClick={() => runOccupant(o.id, "in")}
                              >
                                <DoorOpen className="mr-1 size-3" /> Check in
                              </Button>
                            ) : null}
                            {o.status === "checked_in" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[11px]"
                                disabled={busyId !== null}
                                onClick={() => runOccupant(o.id, "out")}
                              >
                                <LogOut className="mr-1 size-3" /> Check out
                              </Button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-medium text-foreground">
                      {money(b.total, activeHotel?.currency)}
                    </p>
                    {balance > 0.009 && (
                      <p className="text-xs text-destructive">
                        Balance {money(balance, activeHotel?.currency)}
                      </p>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      {b.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId !== null}
                          onClick={() => runConfirm(b.id)}
                        >
                          {busyId === b.id ? "Working…" : "Confirm"}
                        </Button>
                      )}
                      {b.status === "confirmed" && (
                        <Button
                          size="sm"
                          disabled={busyId !== null}
                          onClick={() => runCheckIn(b.id)}
                        >
                          <DoorOpen className="mr-1 size-4" />{" "}
                          {busyId === b.id ? "Working…" : "Check in"}
                        </Button>
                      )}
                      {b.status === "checked_in" && (
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/bookings/$id" params={{ id: b.id }}>
                            Check out
                          </Link>
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/bookings/$id" params={{ id: b.id }}>
                          Open <ArrowRight className="ml-1 size-4" />
                        </Link>
                      </Button>
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
