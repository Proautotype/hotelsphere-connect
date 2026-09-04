import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { createBooking, checkInBooking, checkOutBooking, cancelBooking } from "@/lib/bookings.functions";
import { recordCashPayment } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { money, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({
    meta: [
      { title: "Booking details — Custard Hotels" },
      { name: "description", content: "View and manage a hotel booking." },
      { property: "og:title", content: "Booking details — Custard Hotels" },
      { property: "og:description", content: "View and manage a hotel booking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    if (params.id === "new") return { booking: null };
    const booking = await context.queryClient.ensureQueryData({
      queryKey: ["booking", params.id],
      queryFn: async () => fetchBooking(params.id),
    });
    return { booking };
  },
  component: BookingDetailPage,
});

async function fetchBooking(id: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, guests(*), rooms(room_number), room_types(name), folio_items(*), payments(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function BookingDetailPage() {
  const params = useParams({ from: "/_authenticated/bookings/$id" });
  const isNew = params.id === "new";
  const { activeHotel } = useAuth();
  const [booking, setBooking] = useState<Record<string, unknown> | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");

  const create = useServerFn(createBooking);
  const checkIn = useServerFn(checkInBooking);
  const checkOut = useServerFn(checkOutBooking);
  const cancel = useServerFn(cancelBooking);
  const payCash = useServerFn(recordCashPayment);

  // For a real implementation this page would load the booking via useSuspenseQuery.
  // Here we provide the create form for "new" and a placeholder detail view otherwise.
  if (!isNew) {
    return (
      <DashboardShell title="Booking details">
        <PageHeader title="Booking details" description="Manage this reservation, payments, and check-in/out." />
        <Card className="mt-6">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Booking detail view with folio and payments is under active development.
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  return <NewBookingForm onCreated={(b) => setBooking(b)} />;
}

function NewBookingForm({ onCreated }: { onCreated: (b: { bookingId: string; reference: string; total: number }) => void }) {
  const { activeHotel } = useAuth();
  const create = useServerFn(createBooking);
  const [rooms, setRooms] = useState<{ id: string; room_number: string; room_type_id: string; room_types: { name: string } | null }[]>([]);
  const [guests, setGuests] = useState<{ id: string; full_name: string; phone: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    guestId: "",
    fullName: "",
    phone: "",
    email: "",
    roomId: "",
    checkIn: today(),
    checkOut: "",
    guestsCount: 1,
    note: "",
  });

  const loadLookups = async () => {
    if (!activeHotel) return;
    const [roomsRes, guestsRes] = await Promise.all([
      supabase.from("rooms").select("id, room_number, room_type_id, room_types(name)").eq("hotel_id", activeHotel.id).eq("status", "available"),
      supabase.from("guests").select("id, full_name, phone, email").eq("hotel_id", activeHotel.id).limit(50),
    ]);
    setRooms((roomsRes.data ?? []) as typeof rooms);
    setGuests((guestsRes.data ?? []) as typeof guests);
  };

  useEffect(() => {
    void loadLookups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHotel) return;
    setLoading(true);
    try {
      const result = await create({
        data: {
          hotelId: activeHotel.id,
          guest: {
            id: form.guestId || undefined,
            full_name: form.fullName,
            phone: form.phone,
            email: form.email,
          },
          roomId: form.roomId,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guestsCount: form.guestsCount,
          notes: form.note,
        },
      });
      toast.success(`Booking ${result.reference} created`);
      onCreated(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell title="New booking">
      <PageHeader title="Create booking" description="Reserve a room and open a guest folio." />
      <Card className="mt-6">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Returning guest</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.guestId}
                onChange={(e) => {
                  const g = guests.find((x) => x.id === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    guestId: e.target.value,
                    fullName: g?.full_name ?? "",
                    phone: g?.phone ?? "",
                    email: g?.email ?? "",
                  }));
                }}
              >
                <option value="">New guest</option>
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>{g.full_name} {g.phone ? `· ${g.phone}` : ""}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="fullName">Guest name</Label>
              <Input id="fullName" required value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="roomId">Room</Label>
              <select
                id="roomId"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.roomId}
                onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))}
              >
                <option value="">Select a room</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.room_number} · {r.room_types?.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="checkIn">Check in</Label>
              <Input id="checkIn" type="date" required value={form.checkIn} onChange={(e) => setForm((p) => ({ ...p, checkIn: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="checkOut">Check out</Label>
              <Input id="checkOut" type="date" required value={form.checkOut} onChange={(e) => setForm((p) => ({ ...p, checkOut: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="guestsCount">Guests</Label>
              <Input id="guestsCount" type="number" min={1} max={20} value={form.guestsCount} onChange={(e) => setForm((p) => ({ ...p, guestsCount: parseInt(e.target.value || "1", 10) }))} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="note">Notes</Label>
              <Input id="note" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create booking"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
