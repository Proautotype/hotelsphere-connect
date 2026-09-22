import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllocationsForHotel } from "@/lib/controller.functions";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { HotelSummary } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarDays,
  DoorOpen,
  BedDouble,
  CreditCard,
  ArrowRight,
  Building2,
  GraduationCap,
  Users,
} from "lucide-react";
import { money, stayRange, today } from "@/lib/format";

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
  component: DashboardPage,
});

async function fetchDashboardStats(hotelId: string) {
  const todayStr = today();
  const startOfMonth = `${todayStr.slice(0, 7)}-01`;

  const [checkIns, checkOuts, inHouse, rooms, payments, upcoming, outstanding, monthly] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_in", todayStr)
        .not("status", "in", "(cancelled,no_show,checked_out)"),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("check_out", todayStr)
        .eq("status", "checked_in"),
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("hotel_id", hotelId)
        .eq("status", "checked_in"),
      supabase.from("rooms").select("status", { count: "exact" }).eq("hotel_id", hotelId),
      supabase
        .from("payments")
        .select("amount", { count: "exact" })
        .eq("hotel_id", hotelId)
        // A refund is a negative amount with status 'refunded'. Leaving it out
        // would report gross takings as if they were net.
        .in("status", ["successful", "refunded"])
        .gte("created_at", todayStr),
      supabase
        .from("bookings")
        .select("id, reference, check_in, check_out, guests(full_name), rooms(room_number), status")
        .eq("hotel_id", hotelId)
        .gte("check_in", todayStr)
        .order("check_in", { ascending: true })
        .limit(5),
      supabase
        .from("bookings")
        .select("total, amount_paid")
        .eq("hotel_id", hotelId)
        .not("status", "in", "(cancelled,checked_out)"),
      supabase
        .from("payments")
        .select("amount", { count: "exact" })
        .eq("hotel_id", hotelId)
        .in("status", ["successful", "refunded"])
        .gte("created_at", startOfMonth),
    ]);

  const roomCounts = (rooms.data ?? []).reduce(
    (acc: Record<string, number>, r: { status: string }) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const balance = (outstanding.data ?? []).reduce(
    (sum: number, b: { total: number; amount_paid: number }) =>
      sum + Math.max(0, Number(b.total) - Number(b.amount_paid)),
    0,
  );
  const todayRevenue = (payments.data ?? []).reduce(
    (sum: number, p: { amount: number }) => sum + Number(p.amount ?? 0),
    0,
  );
  const monthlyRevenue = (monthly.data ?? []).reduce(
    (sum: number, p: { amount: number }) => sum + Number(p.amount ?? 0),
    0,
  );

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

/** A stay with no agreed departure date runs until somebody ends it. */
const OPEN_ENDED = "9999-12-31";
const BLOCKED_ROOM_STATUSES = ["out_of_service", "maintenance"];

/**
 * Numbers a hostel warden actually needs. Two of the hotel figures are wrong
 * here and are replaced rather than reused:
 *
 *  - Occupancy counted rooms, but a room turns "occupied" on its first
 *    occupant, so a 4-bed dorm holding one student read as full.
 *  - "In-house guests" counted bookings, but everyone sharing a room shares one
 *    booking (one folio per room), so a full dorm read as a single guest.
 *
 * Both are counted from `occupancies` instead, which is one row per person.
 */
async function fetchHostelStats(hotelId: string) {
  const todayStr = today();
  const startOfMonth = `${todayStr.slice(0, 7)}-01`;
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const [
    rooms,
    occupants,
    inHouse,
    unplaced,
    awaitingSchool,
    openOffers,
    endingSoon,
    openEnded,
    ledger,
    collected,
  ] = await Promise.all([
    supabase
      .from("rooms")
      .select("id, room_number, status, room_types(name, max_guests)")
      .eq("hotel_id", hotelId)
      .order("room_number", { ascending: true }),
    // Rows, not a head count: the bed board needs them bucketed by room, and
    // the parent booking's dates decide whether a bed is taken today.
    supabase
      .from("occupancies")
      .select("id, room_id, status, bookings(check_in, check_out, status)")
      .eq("hotel_id", hotelId)
      .in("status", ["reserved", "checked_in"])
      .limit(2000),
    supabase
      .from("occupancies")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "checked_in"),
    supabase
      .from("occupancies")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "reserved")
      .is("room_id", null),
    supabase
      .from("student_allocations")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "confirmed"),
    supabase
      .from("allocation_offers")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "offered"),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "checked_in")
      .gte("check_out", todayStr)
      .lte("check_out", in30),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("status", "checked_in")
      .is("check_out", null),
    supabase
      .from("bookings")
      .select("total, amount_paid")
      .eq("hotel_id", hotelId)
      .not("status", "in", "(cancelled,no_show,checked_out)"),
    supabase
      .from("payments")
      .select("amount")
      .eq("hotel_id", hotelId)
      .in("status", ["successful", "refunded"])
      .gte("created_at", startOfMonth),
  ]);

  // Capacity is max_guests, because that is the number createBooking and
  // checkInStudentAllocation already refuse to exceed. Counting bed_count here
  // would advertise beds the server will not sell.
  const capacityByRoom = new Map<string, number>();
  const board: { id: string; room_number: string; name: string; capacity: number }[] = [];
  let totalBeds = 0;
  let offlineBeds = 0;
  let untypedRooms = 0;

  (rooms.data ?? []).forEach((r) => {
    const roomType = r.room_types as unknown as { name: string; max_guests: number } | null;
    const beds = Number(roomType?.max_guests ?? 0);
    // No room type means no known capacity. Guessing would make the percentage
    // a lie, so the room is left out of both sides and flagged instead.
    if (!roomType || beds <= 0) {
      untypedRooms += 1;
      return;
    }
    if (BLOCKED_ROOM_STATUSES.includes(r.status)) {
      offlineBeds += beds;
      return;
    }
    capacityByRoom.set(r.id, beds);
    board.push({ id: r.id, room_number: r.room_number, name: roomType.name, capacity: beds });
    totalBeds += beds;
  });

  const filledByRoom = new Map<string, number>();
  (occupants.data ?? []).forEach((o) => {
    const booking = o.bookings as unknown as {
      check_in: string;
      check_out: string | null;
      status: string;
    } | null;
    if (!booking || ["cancelled", "no_show"].includes(booking.status)) return;
    // Next term's reservations are not today's beds.
    const covers = booking.check_in <= todayStr && (booking.check_out ?? OPEN_ENDED) > todayStr;
    if (!covers) return;
    if (!o.room_id || !capacityByRoom.has(o.room_id)) return;
    filledByRoom.set(o.room_id, (filledByRoom.get(o.room_id) ?? 0) + 1);
  });

  const bedsFilled = [...filledByRoom.values()].reduce((sum, n) => sum + n, 0);
  const bedsFree = Math.max(0, totalBeds - bedsFilled);
  const bedOccupancy = totalBeds ? Math.round((bedsFilled / totalBeds) * 100) : 0;

  const bedBoard = board
    .map((r) => ({ ...r, filled: filledByRoom.get(r.id) ?? 0 }))
    .sort((a, b) => b.capacity - b.filled - (a.capacity - a.filled));
  const roomsWithSpace = bedBoard.filter((r) => r.filled < r.capacity).length;

  // Billed, collected and outstanding all come from bookings, so the three
  // always reconcile. Term fees arrive in one or two lumps, which makes a
  // "today's revenue" figure meaningless for a hostel.
  const rows = (ledger.data ?? []) as { total: number; amount_paid: number }[];
  const billed = rows.reduce((sum, b) => sum + Number(b.total), 0);
  const collectedToDate = rows.reduce((sum, b) => sum + Number(b.amount_paid), 0);
  const outstanding = rows.reduce(
    (sum, b) => sum + Math.max(0, Number(b.total) - Number(b.amount_paid)),
    0,
  );
  const collectionRate = billed ? Math.round((collectedToDate / billed) * 100) : 0;
  const collectedThisMonth = (collected.data ?? []).reduce(
    (sum, pmt) => sum + Number(pmt.amount ?? 0),
    0,
  );

  return {
    bedsFilled,
    bedsFree,
    totalBeds,
    bedOccupancy,
    offlineBeds,
    untypedRooms,
    roomsWithSpace,
    bedBoard,
    residents: inHouse.count ?? 0,
    awaitingSchool: awaitingSchool.count ?? 0,
    unplaced: unplaced.count ?? 0,
    openOffers: openOffers.count ?? 0,
    endingSoon: endingSoon.count ?? 0,
    openEnded: openEnded.count ?? 0,
    billed,
    collectedToDate,
    outstanding,
    collectionRate,
    collectedThisMonth,
  };
}

function DashboardLoading({ name }: { name: string }) {
  return (
    <DashboardShell title="Dashboard">
      <PageHeader title={name} description="Loading today's numbers…" />
    </DashboardShell>
  );
}

function DashboardPage() {
  const { activeHotel, isPlatformAdmin } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  // A hostel sells beds by the semester, so almost none of the nightly numbers
  // mean anything to it. It gets its own set.
  const isHostel = activeHotel?.hotel_type === "hostel";

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats", hotelId],
    queryFn: () => fetchDashboardStats(hotelId),
    enabled: Boolean(hotelId) && !isHostel,
  });
  const { data: hostelStats } = useQuery({
    queryKey: ["dashboard", "hostel-stats", hotelId],
    queryFn: () => fetchHostelStats(hotelId),
    enabled: Boolean(hotelId) && isHostel,
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

  if (isHostel) {
    return hostelStats ? (
      <HostelDashboard activeHotel={activeHotel} stats={hostelStats} />
    ) : (
      <DashboardLoading name={activeHotel.name} />
    );
  }

  if (!stats) return <DashboardLoading name={activeHotel.name} />;

  return <HotelDashboard activeHotel={activeHotel} stats={stats} />;
}

function HotelDashboard({
  activeHotel,
  stats,
}: {
  activeHotel: HotelSummary;
  stats: Awaited<ReturnType<typeof fetchDashboardStats>>;
}) {
  const occupancy = stats.totalRooms ? Math.round((stats.occupied / stats.totalRooms) * 100) : 0;

  return (
    <DashboardShell title="Dashboard">
      <PageHeader
        title={activeHotel.name}
        description={
          activeHotel.onboarding_completed
            ? "Hotel operations overview"
            : "Finish onboarding to start taking bookings."
        }
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
              <p className="text-sm text-muted-foreground">
                Complete room types, rooms, and payment methods to go live.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to="/onboarding">Continue onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Check-ins today" value={stats.checkIns} icon={DoorOpen} tone="primary" />
        <StatCard
          label="Check-outs today"
          value={stats.checkOuts}
          icon={CalendarDays}
          tone="warning"
        />
        <StatCard label="In-house guests" value={stats.inHouse} icon={BedDouble} tone="accent" />
        <StatCard label="Occupancy" value={`${occupancy}%`} icon={Building2} tone="success" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available rooms" value={stats.available} icon={BedDouble} tone="success" />
        <StatCard label="Cleaning" value={stats.cleaning} icon={BedDouble} tone="warning" />
        <StatCard
          label="Maintenance"
          value={stats.maintenance}
          icon={BedDouble}
          tone="destructive"
        />
        <StatCard
          label="Outstanding balance"
          value={money(stats.outstanding, activeHotel.currency)}
          icon={CreditCard}
          tone="destructive"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Upcoming arrivals & stays</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/bookings">
                View all <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming bookings"
                description="Create a booking to see it here."
              />
            ) : (
              <div className="space-y-3">
                {(
                  stats.upcoming as Array<{
                    id: string;
                    reference: string;
                    check_in: string;
                    check_out: string;
                    status: string;
                    guests: unknown;
                    rooms: unknown;
                  }>
                ).map((b) => {
                  const guest = b.guests as unknown as { full_name: string } | null;
                  const room = b.rooms as unknown as { room_number: string } | null;
                  return (
                    <Link
                      key={b.id}
                      to="/bookings/$id"
                      params={{ id: b.id }}
                      className="group flex items-center justify-between border-[3px] border-ink bg-card p-3 transition-all hover:-translate-y-0.5 hover:bg-amber hover:text-amber-foreground hover:shadow-hard"
                    >
                      <div>
                        <p className="font-display font-semibold">{b.reference}</p>
                        <p className="text-sm opacity-80">
                          {guest?.full_name} · Room {room?.room_number}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <StatusBadge status={b.status} />
                          <p className="mt-1 text-xs opacity-80">
                            {stayRange(b.check_in, b.check_out)}
                          </p>
                        </div>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-semibold text-foreground">
                {money(stats.todayRevenue, activeHotel.currency)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This month</p>
              <p className="text-2xl font-semibold text-foreground">
                {money(stats.monthlyRevenue, activeHotel.currency)}
              </p>
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

function HostelDashboard({
  activeHotel,
  stats,
}: {
  activeHotel: HotelSummary;
  stats: Awaited<ReturnType<typeof fetchHostelStats>>;
}) {
  const listAllocations = useServerFn(listAllocationsForHotel);
  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations", "students", activeHotel.id],
    queryFn: () => listAllocations({ data: { hotelId: activeHotel.id } }),
    enabled: Boolean(activeHotel.id),
  });
  const movingIn = allocations.filter((a) => a.status === "confirmed").slice(0, 5);

  return (
    <DashboardShell title="Dashboard">
      <PageHeader
        title={activeHotel.name}
        description={
          activeHotel.onboarding_completed
            ? "Beds, residents and term fees"
            : "Finish onboarding to start taking residents."
        }
        actions={
          <Button asChild>
            <Link to="/allocations">Schools & allocations</Link>
          </Button>
        }
      />

      {!activeHotel.onboarding_completed && (
        <Card className="mt-4 border-amber/30 bg-amber/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-medium text-foreground">Onboarding in progress</p>
              <p className="text-sm text-muted-foreground">
                Add your dorms and their per-stay prices to start taking residents.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to="/onboarding">Continue onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bed occupancy"
          value={`${stats.bedOccupancy}%`}
          hint={
            stats.untypedRooms > 0
              ? `${stats.bedsFilled} of ${stats.totalBeds} beds · ${stats.untypedRooms} room${stats.untypedRooms === 1 ? "" : "s"} need a room type`
              : `${stats.bedsFilled} of ${stats.totalBeds} beds · ${stats.bedsFree} free`
          }
          icon={BedDouble}
          tone="success"
        />
        <StatCard
          label="Residents in house"
          value={stats.residents}
          hint={`${stats.roomsWithSpace} room${stats.roomsWithSpace === 1 ? "" : "s"} still have space`}
          icon={Users}
          tone="accent"
        />
        <StatCard
          label="Awaiting move-in"
          value={stats.awaitingSchool + stats.unplaced}
          hint={`${stats.awaitingSchool} confirmed by schools · ${stats.unplaced} with no bed yet`}
          icon={DoorOpen}
          tone="primary"
        />
        <StatCard
          label="Term fees outstanding"
          value={money(stats.outstanding, activeHotel.currency)}
          hint={`${stats.collectionRate}% collected of ${money(stats.billed, activeHotel.currency)}`}
          icon={CreditCard}
          tone="destructive"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Stays ending in 30 days" value={stats.endingSoon} icon={CalendarDays} />
        <StatCard
          label="Open-ended residents"
          value={stats.openEnded}
          hint="No agreed leaving date"
          icon={CalendarDays}
          tone="warning"
        />
        <StatCard
          label="Open school offers"
          value={stats.openOffers}
          hint="Waiting on a school's answer"
          icon={GraduationCap}
        />
        <StatCard
          label="Beds offline"
          value={stats.offlineBeds}
          hint="Maintenance or out of service"
          icon={BedDouble}
          tone="warning"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Beds by room</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/rooms">
                Manage rooms <ArrowRight className="ml-1 size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats.bedBoard.length === 0 ? (
              <EmptyState
                icon={BedDouble}
                title="No rooms yet"
                description="Add a room type with its bed count, then add rooms to it."
              />
            ) : (
              <div className="space-y-2">
                {/* Emptiest first, so "where do I put this student" is the top row. */}
                {stats.bedBoard.map((room) => {
                  const free = room.capacity - room.filled;
                  return (
                    <div
                      key={room.id}
                      className="ink flex flex-wrap items-center justify-between gap-2 bg-background p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-display text-sm font-extrabold tracking-tight">
                          Room {room.room_number}
                        </p>
                        <p className="text-xs text-muted-foreground">{room.name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {room.filled} / {room.capacity} beds
                        </span>
                        <StatusBadge
                          status={
                            free === 0
                              ? "occupied"
                              : room.filled === 0
                                ? "available"
                                : "partly full"
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Term fees</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Billed</p>
                <p className="text-2xl font-semibold text-foreground">
                  {money(stats.billed, activeHotel.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected · {stats.collectionRate}%</p>
                <p className="text-2xl font-semibold text-foreground">
                  {money(stats.collectedToDate, activeHotel.currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected this month</p>
                <p className="text-lg font-semibold text-foreground">
                  {money(stats.collectedThisMonth, activeHotel.currency)}
                </p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/payments">View payments</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Moving in</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/allocations">
                  All <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {movingIn.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody is waiting to move in.</p>
              ) : (
                <div className="space-y-2">
                  {movingIn.map((a) => {
                    const student = a.students as unknown as { full_name: string } | null;
                    return (
                      <div key={a.id} className="text-sm">
                        <p className="font-medium text-foreground">
                          {student?.full_name ?? "Student"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.school?.name ?? "School"}
                          {a.price ? ` · ${money(a.price, activeHotel.currency)}` : ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
