import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { createBooking, confirmBooking, checkInBooking, checkOutBooking, cancelBooking, addFolioCharge } from "@/lib/bookings.functions";
import { recordCashPayment, initializePaystackPayment } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { money, shortDate, dateTime, today, titleCase } from "@/lib/format";
import { FOLIO_CATEGORIES } from "@/lib/permissions";
import { Printer, Plus, Smartphone, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({
    meta: [
      { title: "Booking details — Custard Hotels" },
      { name: "description", content: "Manage a reservation: folio charges, payments, check-in and check-out." },
      { property: "og:title", content: "Booking details — Custard Hotels" },
      { property: "og:description", content: "Manage a reservation: folio charges, payments, check-in and check-out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <DashboardShell title="Booking">
      <div className="mt-6 border-[3px] border-ink bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Could not open this booking</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </DashboardShell>
  ),
  component: BookingDetailPage,

});

interface FolioItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
}

interface PaymentRow {
  id: string;
  receipt_number: string;
  amount: number;
  method: string;
  status: string;
  provider: string;
  created_at: string;
}

interface BookingDetail {
  id: string;
  reference: string;
  status: string;
  check_in: string;
  check_out: string;
  nights: number | null;
  guests_count: number;
  room_rate: number;
  discount: number;
  tax_amount: number;
  service_charge: number;
  services_total: number;
  total: number;
  amount_paid: number;
  notes: string;
  created_at: string;
  hotel_id: string;
  guests: { id: string; full_name: string; email: string | null; phone: string | null; country: string | null } | null;
  rooms: { room_number: string } | null;
  room_types: { name: string } | null;
  folio_items: FolioItem[];
  payments: PaymentRow[];
  hotels: { name: string; address: string; city: string; phone: string | null; email: string | null; currency: string } | null;
}

async function fetchBooking(id: string): Promise<BookingDetail> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, guests(id, full_name, email, phone, country), rooms(room_number), room_types(name), folio_items(*), payments(*), hotels(name, address, city, phone, email, currency)",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as BookingDetail;
}

function BookingDetailPage() {
  const params = useParams({ from: "/_authenticated/bookings/$id" });
  if (params.id === "new") return <NewBookingForm />;
  return <BookingDetail id={params.id} />;
}

function BookingDetail({ id }: { id: string }) {
  const { activeHotel, can } = useAuth();
  const { data: booking, refetch } = useSuspenseQuery({ queryKey: ["booking", id], queryFn: () => fetchBooking(id) });
  const currency = booking.hotels?.currency ?? activeHotel?.currency ?? "GHS";

  const confirm = useServerFn(confirmBooking);
  const checkIn = useServerFn(checkInBooking);
  const checkOut = useServerFn(checkOutBooking);
  const cancel = useServerFn(cancelBooking);
  const addCharge = useServerFn(addFolioCharge);
  const payCash = useServerFn(recordCashPayment);
  const payMomo = useServerFn(initializePaystackPayment);

  const [busy, setBusy] = useState(false);
  const [charge, setCharge] = useState({ category: "food", description: "", quantity: 1, unitPrice: 0 });
  const [paymentAmount, setPaymentAmount] = useState("");

  const balance = Number(booking.total) - Number(booking.amount_paid);
  const closed = ["checked_out", "cancelled"].includes(booking.status);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const submitCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    await run("Charge posted to folio", async () => {
      await addCharge({
        data: {
          bookingId: booking.id,
          category: charge.category,
          description: charge.description,
          quantity: charge.quantity,
          unitPrice: charge.unitPrice,
        },
      });
      setCharge({ category: "food", description: "", quantity: 1, unitPrice: 0 });
    });
  };

  const submitCash = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    await run("Payment recorded", async () => {
      await payCash({ data: { bookingId: booking.id, amount, note: "Front desk cash payment" } });
      setPaymentAmount("");
    });
  };

  const submitMomo = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a payment amount");
      return;
    }
    const email = booking.guests?.email;
    if (!email) {
      toast.error("Add an email to the guest profile to charge Mobile Money");
      return;
    }
    setBusy(true);
    try {
      const res = await payMomo({ data: { bookingId: booking.id, email, amount } });
      window.open(res.authorizationUrl, "_blank", "noopener");
      toast.success("Approve the charge on the customer's phone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Mobile Money charge failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell title={booking.reference}>
      <PageHeader
        title={booking.reference}
        description={`${booking.guests?.full_name ?? "Guest"} · ${booking.room_types?.name ?? ""} ${booking.rooms?.room_number ? `· Room ${booking.rooms.room_number}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 size-4" /> Invoice
            </Button>
            {booking.status === "pending" ? (
              <Button
                disabled={busy}
                onClick={() =>
                  run("Booking confirmed", () => confirm({ data: { bookingId: booking.id } }))
                }
              >
                Confirm booking
              </Button>
            ) : null}
            {booking.status === "confirmed" ? (
              <Button disabled={busy} onClick={() => run("Guest checked in", () => checkIn({ data: { bookingId: booking.id } }))}>
                Check in
              </Button>
            ) : null}
            {booking.status === "checked_in" ? (
              <Button disabled={busy} onClick={() => run("Guest checked out", () => checkOut({ data: { bookingId: booking.id } }))}>
                Check out
              </Button>
            ) : null}
            {!closed && booking.status !== "checked_in" ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Cancel this booking?")) return;
                  void run("Booking cancelled", () => cancel({ data: { bookingId: booking.id, reason: "Cancelled at front desk" } }));
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* printable invoice */}
          <Card id="invoice">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b-[3px] border-ink pb-4">
                <div>
                  <p className="font-display text-xl font-extrabold italic tracking-tighter text-foreground">
                    {booking.hotels?.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.hotels?.address}, {booking.hotels?.city}
                  </p>
                  <p className="text-sm text-muted-foreground">{booking.hotels?.phone} {booking.hotels?.email}</p>
                </div>
                <div className="text-right">
                  <p className="kinetic-label text-xs text-foreground">Invoice</p>
                  <p className="font-display font-semibold text-foreground">{booking.reference}</p>
                  <p className="text-xs text-muted-foreground">{dateTime(booking.created_at)}</p>
                  <div className="mt-1 flex justify-end"><StatusBadge status={booking.status} /></div>
                </div>
              </div>

              <div className="grid gap-4 border-b-[3px] border-ink py-4 sm:grid-cols-2">
                <div>
                  <p className="kinetic-label text-[10px] text-muted-foreground">Guest</p>
                  <p className="font-medium text-foreground">{booking.guests?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{booking.guests?.phone}</p>
                  <p className="text-sm text-muted-foreground">{booking.guests?.email}</p>
                </div>
                <div className="sm:text-right">
                  <p className="kinetic-label text-[10px] text-muted-foreground">Stay</p>
                  <p className="font-medium text-foreground">{shortDate(booking.check_in)} → {shortDate(booking.check_out)}</p>
                  <p className="text-sm text-muted-foreground">{booking.nights ?? 0} night(s) · {booking.guests_count} guest(s)</p>
                  <p className="text-sm text-muted-foreground">{booking.room_types?.name} {booking.rooms?.room_number ? `· Room ${booking.rooms.room_number}` : ""}</p>
                </div>
              </div>

              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">Item</th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">Qty</th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">Rate</th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 text-foreground">Accommodation ({booking.nights ?? 0} nights)</td>
                    <td className="py-2 text-right text-muted-foreground">{booking.nights ?? 0}</td>
                    <td className="py-2 text-right text-muted-foreground">{money(booking.room_rate, currency)}</td>
                    <td className="py-2 text-right text-foreground">{money(Number(booking.room_rate) * Number(booking.nights ?? 0), currency)}</td>
                  </tr>
                  {(booking.folio_items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="py-2 text-foreground">
                        {item.description} <span className="text-xs text-muted-foreground">· {titleCase(item.category)}</span>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{item.quantity}</td>
                      <td className="py-2 text-right text-muted-foreground">{money(item.unit_price, currency)}</td>
                      <td className="py-2 text-right text-foreground">{money(item.amount, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
                <Row label="Service charge" value={money(booking.service_charge, currency)} />
                <Row label="Tax" value={money(booking.tax_amount, currency)} />
                {Number(booking.discount) > 0 ? <Row label="Discount" value={`- ${money(booking.discount, currency)}`} /> : null}
                <div className="flex justify-between border-t-[3px] border-ink pt-2">
                  <dt className="kinetic-label text-xs text-foreground">Total</dt>
                  <dd className="font-display font-extrabold text-foreground">{money(booking.total, currency)}</dd>
                </div>
                <Row label="Paid" value={money(booking.amount_paid, currency)} />
                <div className="flex justify-between">
                  <dt className="kinetic-label text-xs text-foreground">Balance</dt>
                  <dd className={balance > 0.009 ? "font-semibold text-destructive" : "font-semibold text-foreground"}>
                    {money(balance, currency)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="kinetic-label text-xs text-foreground">Receipts</h3>
              {(booking.payments ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No payments recorded yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {booking.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between border-b border-border pb-2 text-sm">
                      <div>
                        <p className="font-medium text-foreground">{p.receipt_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {titleCase(p.method)} · {p.provider} · {dateTime(p.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">{money(p.amount, currency)}</p>
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 print:hidden">
          {can("payments:record") ? (
            <Card>
              <CardContent className="p-5">
                <h3 className="kinetic-label text-xs text-foreground">Take payment</h3>
                <p className="mt-1 text-sm text-muted-foreground">Outstanding {money(balance, currency)}</p>
                <div className="mt-3 space-y-3">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    disabled={closed}
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={busy || closed} onClick={submitCash}>
                      <Wallet className="mr-1 size-4" /> Cash
                    </Button>
                    <Button className="flex-1" variant="outline" disabled={busy || closed} onClick={submitMomo}>
                      <Smartphone className="mr-1 size-4" /> Mobile Money
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="p-5">
              <h3 className="kinetic-label text-xs text-foreground">Post a charge</h3>
              <form onSubmit={submitCharge} className="mt-3 space-y-3">
                <div>
                  <Label htmlFor="charge-category">Category</Label>
                  <select
                    id="charge-category"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={charge.category}
                    onChange={(e) => setCharge((p) => ({ ...p, category: e.target.value }))}
                  >
                    {FOLIO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{titleCase(c)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="charge-desc">Description</Label>
                  <Input id="charge-desc" required value={charge.description} onChange={(e) => setCharge((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="charge-qty">Qty</Label>
                    <Input
                      id="charge-qty"
                      type="number"
                      min={1}
                      value={charge.quantity}
                      onChange={(e) => setCharge((p) => ({ ...p, quantity: parseInt(e.target.value || "1", 10) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="charge-price">Unit price</Label>
                    <Input
                      id="charge-price"
                      type="number"
                      min={0}
                      step="0.01"
                      value={charge.unitPrice}
                      onChange={(e) => setCharge((p) => ({ ...p, unitPrice: parseFloat(e.target.value || "0") }))}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy || closed}>
                  <Plus className="mr-1 size-4" /> Post charge
                </Button>
              </form>
            </CardContent>
          </Card>

          {booking.notes ? (
            <Card>
              <CardContent className="p-5">
                <h3 className="kinetic-label text-xs text-foreground">Notes</h3>
                <p className="mt-2 text-sm text-muted-foreground">{booking.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function NewBookingForm() {
  const { activeHotel } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useServerFn(createBooking);
  const [rooms, setRooms] = useState<{ id: string; room_number: string; room_type_id: string | null; room_types: { name: string } | null }[]>([]);
  const [roomTypes, setRoomTypes] = useState<{ id: string; name: string; base_price: number }[]>([]);
  const [guests, setGuests] = useState<{ id: string; full_name: string; phone: string | null; email: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    guestId: "",
    fullName: "",
    phone: "",
    email: "",
    roomId: "",
    roomTypeId: "",
    checkIn: today(),
    checkOut: "",
    guestsCount: 1,
    note: "",
  });

  useEffect(() => {
    const loadLookups = async () => {
      if (!activeHotel) return;
      const [roomsRes, guestsRes, typesRes] = await Promise.all([
        supabase
          .from("rooms")
          .select("id, room_number, room_type_id, room_types(name)")
          .eq("hotel_id", activeHotel.id)
          .in("status", ["available", "inspected", "cleaning"])
          .order("room_number"),
        supabase.from("guests").select("id, full_name, phone, email").eq("hotel_id", activeHotel.id).order("full_name").limit(100),
        supabase.from("room_types").select("id, name, base_price").eq("hotel_id", activeHotel.id).eq("is_active", true).order("name"),
      ]);
      setRooms((roomsRes.data ?? []) as unknown as typeof rooms);
      setGuests((guestsRes.data ?? []) as unknown as typeof guests);
      setRoomTypes((typesRes.data ?? []) as unknown as typeof roomTypes);
    };
    void loadLookups();
  }, [activeHotel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHotel) {
      toast.error("Select a hotel first");
      return;
    }
    if (!form.roomId && !form.roomTypeId) {
      toast.error("Select a room or a room type");
      return;
    }
    setLoading(true);
    try {
      const result = await create({
        data: {
          hotelId: activeHotel.id,
          guest: {
            id: form.guestId || undefined,
            full_name: form.fullName.trim(),
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
          },
          roomId: form.roomId || undefined,
          roomTypeId: form.roomTypeId || undefined,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guestsCount: form.guestsCount,
          notes: form.note.trim() || undefined,
        },
      });
      toast.success(`Booking ${result.reference} created`);
      await queryClient.invalidateQueries({ queryKey: ["bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      navigate({ to: "/bookings/$id", params: { id: result.bookingId } });
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
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.roomId}
                onChange={(e) => {
                  const room = rooms.find((r) => r.id === e.target.value);
                  setForm((p) => ({ ...p, roomId: e.target.value, roomTypeId: room?.room_type_id ?? p.roomTypeId }));
                }}
              >
                <option value="">Unassigned (choose room type)</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>{r.room_number} · {r.room_types?.name}</option>
                ))}
              </select>
              {rooms.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No free rooms — pick a room type instead.</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="roomTypeId">Room type</Label>
              <select
                id="roomTypeId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.roomTypeId}
                onChange={(e) => setForm((p) => ({ ...p, roomTypeId: e.target.value }))}
              >
                <option value="">Select a room type</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} · {money(rt.base_price, activeHotel?.currency)}
                  </option>
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
