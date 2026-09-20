import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createBooking, changeBooking } from "@/lib/bookings.functions";
import { shortDate, today } from "@/lib/format";
import { BedDouble, CalendarRange, ChevronLeft, ChevronRight, Grid3x3, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Booking calendar — Custard Hotels" },
      {
        name: "description",
        content: "See every room and every stay on one chart, and move bookings by dragging them.",
      },
      { property: "og:title", content: "Booking calendar — Custard Hotels" },
      {
        property: "og:description",
        content: "See every room and every stay on one chart, and move bookings by dragging them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage,
});

const DAY = 86_400_000;
const WINDOW_DAYS = 14;

function iso(date: Date) {
  return date.toISOString().split("T")[0]!;
}
function addDays(date: string, days: number) {
  return iso(new Date(new Date(date).getTime() + days * DAY));
}
function diffDays(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / DAY);
}

interface RoomRow {
  id: string;
  room_number: string;
  floor: string;
  status: string;
  room_type_id: string | null;
  room_types: { name: string } | null;
}

interface StayRow {
  id: string;
  reference: string;
  status: string;
  check_in: string;
  check_out: string;
  room_id: string | null;
  room_type_id: string | null;
  guests: { full_name: string } | null;
}

async function fetchRooms(hotelId: string) {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, room_number, floor, status, room_type_id, room_types(name)")
    .eq("hotel_id", hotelId)
    .order("room_number", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RoomRow[];
}

async function fetchStays(hotelId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, status, check_in, check_out, room_id, room_type_id, guests(full_name)",
    )
    .eq("hotel_id", hotelId)
    .not("status", "in", "(cancelled,no_show)")
    .lt("check_in", to)
    .gt("check_out", from)
    .limit(800);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as StayRow[];
}

const STAY_TONE: Record<string, string> = {
  pending: "bg-muted text-foreground",
  confirmed: "bg-primary text-primary-foreground",
  checked_in: "bg-amber text-amber-foreground",
  checked_out: "bg-secondary text-secondary-foreground",
};

function CalendarPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [view, setView] = useState<"grid" | "month">("grid");
  const [start, setStart] = useState(() => today());
  const [monthAnchor, setMonthAnchor] = useState(() => today());
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ roomId: string; date: string } | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [nights, setNights] = useState(1);

  const createFn = useServerFn(createBooking);
  const changeFn = useServerFn(changeBooking);

  const monthStart = useMemo(() => {
    const d = new Date(monthAnchor);
    return iso(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [monthAnchor]);
  const monthEnd = useMemo(() => {
    const d = new Date(monthAnchor);
    return iso(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }, [monthAnchor]);

  const rangeFrom = view === "grid" ? start : monthStart;
  const rangeTo = view === "grid" ? addDays(start, WINDOW_DAYS) : monthEnd;

  const { data: rooms = [] } = useQuery({
    queryKey: ["calendar", "rooms", hotelId],
    queryFn: () => fetchRooms(hotelId),
    enabled: Boolean(hotelId),
  });
  const { data: stays = [] } = useQuery({
    queryKey: ["calendar", "stays", hotelId, rangeFrom, rangeTo],
    queryFn: () => fetchStays(hotelId, rangeFrom, rangeTo),
    enabled: Boolean(hotelId),
  });

  const days = useMemo(
    () => Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(start, i)),
    [start],
  );

  const staysByRoom = useMemo(() => {
    const map = new Map<string, StayRow[]>();
    stays.forEach((s) => {
      if (!s.room_id) return;
      const list = map.get(s.room_id) ?? [];
      list.push(s);
      map.set(s.room_id, list);
    });
    return map;
  }, [stays]);

  const unassigned = useMemo(() => stays.filter((s) => !s.room_id), [stays]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
  };

  const moveStay = async (stayId: string, roomId: string, newCheckIn: string) => {
    const stay = stays.find((s) => s.id === stayId);
    if (!stay || busy) return;
    const stayNights = Math.max(1, diffDays(stay.check_in, stay.check_out));
    setBusy(true);
    try {
      await changeFn({
        data: {
          bookingId: stayId,
          roomId,
          checkIn: newCheckIn,
          checkOut: addDays(newCheckIn, stayNights),
        },
      });
      toast.success("Booking moved");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not move this booking");
    } finally {
      setBusy(false);
    }
  };

  const openDraft = (roomId: string, date: string) => {
    setDraft({ roomId, date });
    setGuestName("");
    setGuestPhone("");
    setNights(1);
  };

  const saveDraft = async () => {
    if (!draft || busy) return;
    const room = rooms.find((r) => r.id === draft.roomId);
    if (!room?.room_type_id) {
      toast.error("Give this room a category first, on the Rooms page.");
      return;
    }
    setBusy(true);
    try {
      const result = await createFn({
        data: {
          hotelId,
          guest: { full_name: guestName.trim(), phone: guestPhone.trim(), country: "Ghana" },
          roomId: draft.roomId,
          roomTypeId: room.room_type_id,
          checkIn: draft.date,
          checkOut: addDays(draft.date, Math.max(1, nights)),
          guestsCount: 1,
          source: "staff",
        },
      });
      toast.success(`Booking ${result.reference} created`);
      setDraft(null);
      refresh();
      void navigate({ to: "/bookings/$id", params: { id: result.bookingId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create this booking");
    } finally {
      setBusy(false);
    }
  };

  const monthCells = useMemo(() => {
    const first = new Date(monthStart);
    const lead = first.getDay();
    const total = diffDays(monthStart, monthEnd);
    const cells: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let i = 0; i < total; i += 1) cells.push(addDays(monthStart, i));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [monthStart, monthEnd]);

  const dayStats = (date: string) => {
    const arrivals = stays.filter((s) => s.check_in === date).length;
    const departures = stays.filter((s) => s.check_out === date).length;
    const inHouse = stays.filter((s) => s.check_in <= date && s.check_out > date).length;
    return { arrivals, departures, inHouse };
  };

  return (
    <DashboardShell title="Booking calendar">
      <PageHeader
        title="Booking calendar"
        description="One row per room, stays across the days. Drag a stay to move it, click a free square to start a booking."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={view === "grid" ? "default" : "outline"}
              onClick={() => setView("grid")}
            >
              <Rows3 className="mr-1 size-4" /> Room chart
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "month" ? "default" : "outline"}
              onClick={() => setView("month")}
            >
              <Grid3x3 className="mr-1 size-4" /> Month
            </Button>
          </div>
        }
      />

      {rooms.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={BedDouble}
            title="No rooms yet"
            description="Add your rooms and the calendar fills up automatically."
            action={
              <Button asChild>
                <Link to="/rooms">Add rooms</Link>
              </Button>
            }
          />
        </div>
      ) : view === "grid" ? (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStart(addDays(start, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setStart(today())}>
              Today
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setStart(addDays(start, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Input
              type="date"
              aria-label="Start from"
              className="w-[160px]"
              value={start}
              onChange={(e) => e.target.value && setStart(e.target.value)}
            />
            <span className="text-sm text-muted-foreground">
              {shortDate(start)} → {shortDate(addDays(start, WINDOW_DAYS - 1))}
            </span>
          </div>

          <div className="overflow-x-auto border-[3px] border-ink bg-card">
            <div className="min-w-[860px]">
              <div
                className="grid border-b-[3px] border-ink bg-muted/40"
                style={{ gridTemplateColumns: `160px repeat(${WINDOW_DAYS}, minmax(48px, 1fr))` }}
              >
                <div className="kinetic-label px-3 py-2 text-[10px]">Room</div>
                {days.map((d) => {
                  const date = new Date(d);
                  const weekend = [0, 6].includes(date.getDay());
                  return (
                    <div
                      key={d}
                      className={cn(
                        "border-l border-ink/20 px-1 py-2 text-center text-[10px] font-bold uppercase",
                        weekend && "bg-amber/20",
                        d === today() && "bg-primary text-primary-foreground",
                      )}
                    >
                      <div>{date.toLocaleDateString("en-GH", { weekday: "narrow" })}</div>
                      <div>{date.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="relative grid border-b border-ink/20"
                  style={{ gridTemplateColumns: `160px repeat(${WINDOW_DAYS}, minmax(48px, 1fr))` }}
                >
                  <div className="min-w-0 px-3 py-3">
                    <p className="truncate text-sm font-semibold">Room {room.room_number}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {room.room_types?.name ?? "No category"}
                    </p>
                  </div>
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-label={`Book room ${room.room_number} on ${d}`}
                      className="h-16 border-l border-ink/15 transition-colors hover:bg-amber/30"
                      onClick={() => openDraft(room.id, d)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData("text/booking-id");
                        if (id) void moveStay(id, room.id, d);
                      }}
                    />
                  ))}

                  {(staysByRoom.get(room.id) ?? []).map((stay) => {
                    const offset = Math.max(0, diffDays(start, stay.check_in));
                    if (offset >= WINDOW_DAYS) return null;
                    const endOffset = Math.min(WINDOW_DAYS, diffDays(start, stay.check_out));
                    const span = Math.max(1, endOffset - offset);
                    return (
                      <div
                        key={stay.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/booking-id", stay.id)}
                        style={{ gridColumn: `${2 + offset} / span ${span}`, gridRow: 1 }}
                        className={cn(
                          "pointer-events-auto z-10 m-2 flex cursor-grab items-center overflow-hidden border-[3px] border-ink px-2 text-[11px] font-bold shadow-hard active:cursor-grabbing",
                          STAY_TONE[stay.status] ?? "bg-secondary text-secondary-foreground",
                        )}
                        onClick={() =>
                          void navigate({ to: "/bookings/$id", params: { id: stay.id } })
                        }
                        title={`${stay.guests?.full_name ?? "Guest"} · ${stay.reference}`}
                      >
                        <span className="truncate">
                          {stay.guests?.full_name ?? "Guest"} · {stay.reference}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {unassigned.length > 0 ? (
            <Card>
              <CardContent className="p-4">
                <p className="kinetic-label text-[10px]">Waiting for a room</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unassigned.map((s) => (
                    <div
                      key={s.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/booking-id", s.id)}
                      className="ink cursor-grab bg-muted px-2 py-1 text-[11px] font-bold"
                    >
                      {s.guests?.full_name ?? "Guest"} · {shortDate(s.check_in)}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Drag one onto a room square to give it a room.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMonthAnchor(addDays(monthStart, -1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="kinetic-label text-xs">
              {new Date(monthStart).toLocaleDateString("en-GH", { month: "long", year: "numeric" })}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMonthAnchor(monthEnd)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="kinetic-label py-1 text-center text-[10px]">
                {d}
              </div>
            ))}
            {monthCells.map((date, index) => {
              if (!date) return <div key={`blank-${index}`} className="min-h-20" />;
              const stats = dayStats(date);
              const full = rooms.length > 0 ? stats.inHouse / rooms.length : 0;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setStart(date);
                    setView("grid");
                  }}
                  className={cn(
                    "min-h-20 border-[3px] border-ink p-1 text-left transition-all hover:-translate-y-0.5 hover:shadow-hard",
                    date === today() ? "bg-primary text-primary-foreground" : "bg-card",
                  )}
                >
                  <span className="text-sm font-extrabold">{new Date(date).getDate()}</span>
                  <div className="mt-1 space-y-0.5 text-[10px] font-semibold">
                    {stats.arrivals > 0 ? <p>{stats.arrivals} in</p> : null}
                    {stats.departures > 0 ? <p>{stats.departures} out</p> : null}
                    {rooms.length > 0 ? (
                      <p className="opacity-70">{Math.round(full * 100)}% full</p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Tap any day to open the room chart from that date.
          </p>
        </div>
      )}

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New booking</DialogTitle>
            <DialogDescription>
              Room {rooms.find((r) => r.id === draft?.roomId)?.room_number} ·{" "}
              {draft ? shortDate(draft.date) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cal-guest">Guest name</Label>
              <Input
                id="cal-guest"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ama Mensah"
              />
            </div>
            <div>
              <Label htmlFor="cal-phone">Phone (optional)</Label>
              <Input
                id="cal-phone"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="024 000 0000"
              />
            </div>
            <div>
              <Label htmlFor="cal-nights">Nights</Label>
              <Input
                id="cal-nights"
                type="number"
                min={1}
                max={60}
                value={nights}
                onChange={(e) => setNights(Number(e.target.value) || 1)}
              />
              {draft ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Leaving {shortDate(addDays(draft.date, Math.max(1, nights)))}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || guestName.trim().length < 2}
              onClick={() => void saveDraft()}
            >
              {busy ? "Saving…" : "Create booking"}
            </Button>
          </DialogFooter>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarRange className="size-4" /> Stays from Booking.com, Expedia and other sites appear
        here once you link them under Channels.
      </p>
    </DashboardShell>
  );
}
