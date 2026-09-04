import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { createRoom, createRoomType } from "@/lib/rooms.functions";
import { BedDouble, Layers, Plus } from "lucide-react";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Custard Hotels" },
      { name: "description", content: "Manage hotel rooms, room types and room statuses." },
      { property: "og:title", content: "Rooms — Custard Hotels" },
      { property: "og:description", content: "Manage hotel rooms, room types and room statuses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoomsPage,
});

interface RoomTypeRow {
  id: string;
  name: string;
  base_price: number;
  max_guests: number;
}

interface RoomRow {
  id: string;
  room_number: string;
  status: string;
  floor: string;
  room_types: { name: string; base_price: number; max_guests: number } | null;
}

async function fetchRooms(hotelId: string): Promise<RoomRow[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select("id, room_number, status, floor, room_types(name, base_price, max_guests)")
    .eq("hotel_id", hotelId)
    .order("room_number", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RoomRow[];
}

async function fetchRoomTypes(hotelId: string): Promise<RoomTypeRow[]> {
  const { data, error } = await supabase
    .from("room_types")
    .select("id, name, base_price, max_guests")
    .eq("hotel_id", hotelId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RoomTypeRow[];
}

const STATUS_ORDER = [
  "available",
  "reserved",
  "occupied",
  "cleaning",
  "dirty",
  "inspected",
  "maintenance",
  "out_of_service",
];

function RoomsPage() {
  const { activeHotel, can } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const queryClient = useQueryClient();

  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", "list", hotelId],
    queryFn: () => fetchRooms(hotelId),
    enabled: Boolean(hotelId),
  });
  const { data: roomTypes = [] } = useQuery({
    queryKey: ["room_types", "list", hotelId],
    queryFn: () => fetchRoomTypes(hotelId),
    enabled: Boolean(hotelId),
  });

  const addRoom = useServerFn(createRoom);
  const addRoomType = useServerFn(createRoomType);

  const [roomOpen, setRoomOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [roomForm, setRoomForm] = useState({ roomNumber: "", floor: "", roomTypeId: "" });
  const [typeForm, setTypeForm] = useState({ name: "", basePrice: "", maxGuests: 2, bedCount: 1, bedType: "Double" });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    await queryClient.invalidateQueries({ queryKey: ["room_types"] });
  };

  const submitRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId) return;
    setBusy(true);
    try {
      const res = await addRoom({
        data: {
          hotelId,
          roomTypeId: roomForm.roomTypeId,
          roomNumber: roomForm.roomNumber.trim(),
          floor: roomForm.floor.trim(),
        },
      });
      toast.success(`Room ${res.roomNumber} added`);
      setRoomForm({ roomNumber: "", floor: "", roomTypeId: roomForm.roomTypeId });
      setRoomOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add room");
    } finally {
      setBusy(false);
    }
  };

  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId) return;
    setBusy(true);
    try {
      const res = await addRoomType({
        data: {
          hotelId,
          name: typeForm.name.trim(),
          basePrice: parseFloat(typeForm.basePrice || "0"),
          maxGuests: typeForm.maxGuests,
          bedCount: typeForm.bedCount,
          bedType: typeForm.bedType,
        },
      });
      toast.success(`${res.name} room type created`);
      setTypeForm({ name: "", basePrice: "", maxGuests: 2, bedCount: 1, bedType: "Double" });
      setTypeOpen(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create room type");
    } finally {
      setBusy(false);
    }
  };

  const canManage = can("rooms:manage");

  const statusGroups: Record<string, RoomRow[]> = {};
  STATUS_ORDER.forEach((s) => (statusGroups[s] = []));
  rooms.forEach((r) => {
    (statusGroups[r.status] ??= []).push(r);
  });

  return (
    <DashboardShell title="Rooms">
      <PageHeader
        title="Rooms"
        description="Room inventory, status, and assignment."
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Layers className="mr-1 size-4" /> New room type
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New room type</DialogTitle>
                    <DialogDescription>Room types carry the nightly rate and occupancy.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={submitType} className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="rt-name">Name</Label>
                      <Input
                        id="rt-name"
                        required
                        placeholder="Deluxe Double"
                        value={typeForm.name}
                        onChange={(e) => setTypeForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rt-price">Nightly rate</Label>
                      <Input
                        id="rt-price"
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={typeForm.basePrice}
                        onChange={(e) => setTypeForm((p) => ({ ...p, basePrice: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rt-guests">Max guests</Label>
                      <Input
                        id="rt-guests"
                        type="number"
                        min={1}
                        max={20}
                        value={typeForm.maxGuests}
                        onChange={(e) => setTypeForm((p) => ({ ...p, maxGuests: parseInt(e.target.value || "1", 10) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rt-beds">Beds</Label>
                      <Input
                        id="rt-beds"
                        type="number"
                        min={1}
                        max={10}
                        value={typeForm.bedCount}
                        onChange={(e) => setTypeForm((p) => ({ ...p, bedCount: parseInt(e.target.value || "1", 10) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="rt-bedtype">Bed type</Label>
                      <Input
                        id="rt-bedtype"
                        value={typeForm.bedType}
                        onChange={(e) => setTypeForm((p) => ({ ...p, bedType: e.target.value }))}
                      />
                    </div>
                    <DialogFooter className="sm:col-span-2">
                      <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create room type"}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-1 size-4" /> New room
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New room</DialogTitle>
                    <DialogDescription>Add a physical room to this hotel's inventory.</DialogDescription>
                  </DialogHeader>
                  {roomTypes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Create a room type first — rooms inherit their rate from the room type.
                    </p>
                  ) : (
                    <form onSubmit={submitRoom} className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="room-number">Room number</Label>
                        <Input
                          id="room-number"
                          required
                          value={roomForm.roomNumber}
                          onChange={(e) => setRoomForm((p) => ({ ...p, roomNumber: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="room-floor">Floor</Label>
                        <Input
                          id="room-floor"
                          value={roomForm.floor}
                          onChange={(e) => setRoomForm((p) => ({ ...p, floor: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="room-type">Room type</Label>
                        <select
                          id="room-type"
                          required
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={roomForm.roomTypeId}
                          onChange={(e) => setRoomForm((p) => ({ ...p, roomTypeId: e.target.value }))}
                        >
                          <option value="">Select a room type</option>
                          {roomTypes.map((rt) => (
                            <option key={rt.id} value={rt.id}>
                              {rt.name} · {money(rt.base_price, activeHotel?.currency)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <DialogFooter className="sm:col-span-2">
                        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Add room"}</Button>
                      </DialogFooter>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          ) : null
        }
      />

      {rooms.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <BedDouble className="size-8 text-muted-foreground" />
            <p className="font-display text-lg font-semibold text-foreground">No rooms yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Add a room type with its nightly rate, then add the rooms that belong to it.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(statusGroups).map(([status, list]) => (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <StatusBadge status={status} />
                  <span className="text-lg font-semibold text-foreground">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No rooms</p>
                  ) : (
                    list.map((room) => (
                      <div key={room.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                        <div>
                          <p className="text-sm font-medium text-foreground">{room.room_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {room.room_types?.name} · {room.room_types?.max_guests} guests
                          </p>
                        </div>
                        <p className="text-xs font-medium text-foreground">
                          {money(room.room_types?.base_price ?? 0, activeHotel?.currency)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
