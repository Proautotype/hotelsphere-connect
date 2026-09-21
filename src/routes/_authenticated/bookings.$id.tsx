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
import {
  createBooking,
  confirmBooking,
  checkInBooking,
  checkOutBooking,
  checkInOccupancy,
  checkOutOccupancy,
  previewCheckOut,
  cancelBooking,
  addFolioCharge,
} from "@/lib/bookings.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { recordCashPayment, initializePaystackPayment } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { money, shortDate, dateTime, today, titleCase } from "@/lib/format";
import { FOLIO_CATEGORIES } from "@/lib/permissions";
import { Printer, Plus, Smartphone, Wallet } from "lucide-react";

type RefundMethod = "none" | "cash" | "mobile_money";
interface CheckOutPreview {
  early: boolean;
  unusedNights: number;
  unusedValue: number;
  adjustedTotal: number;
  outstanding: number;
  grossRefund: number;
  withheld: number;
  netRefund: number;
}

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({
    meta: [
      { title: "Booking details — Custard Hotels" },
      {
        name: "description",
        content: "Manage a reservation: folio charges, payments, check-in and check-out.",
      },
      { property: "og:title", content: "Booking details — Custard Hotels" },
      {
        property: "og:description",
        content: "Manage a reservation: folio charges, payments, check-in and check-out.",
      },
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

interface OccupancyRow {
  id: string;
  bed_number: string | null;
  price: number;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  guests: { full_name: string; phone: string | null; email: string | null } | null;
}

interface BookingDetail {
  id: string;
  reference: string;
  status: string;
  check_in: string;
  check_out: string;
  nights: number | null;
  guests_count: number;
  pricing_model: string;
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
  guests: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    country: string | null;
  } | null;
  rooms: { room_number: string } | null;
  room_types: { name: string } | null;
  folio_items: FolioItem[];
  payments: PaymentRow[];
  occupancies: OccupancyRow[];
  hotels: {
    name: string;
    address: string;
    city: string;
    phone: string | null;
    email: string | null;
    currency: string;
  } | null;
  source: string;
  channel_connection_id: string | null;
  channel_connections: {
    provider: string;
    label: string;
    status: string;
    last_sync_at: string | null;
    last_sync_ok: boolean | null;
    last_sync_message: string | null;
  } | null;
  channel_bookings: {
    external_uid: string;
    summary: string;
    last_seen_at: string;
  }[];
}

async function fetchBooking(id: string, hotelId: string): Promise<BookingDetail> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "*, guests(id, full_name, email, phone, country), rooms(room_number), room_types(name), folio_items(*), payments(*), occupancies(*, guests(full_name, phone, email)), hotels(name, address, city, phone, email, currency), channel_connections(provider, label, status, last_sync_at, last_sync_ok, last_sync_message), channel_bookings(external_uid, summary, last_seen_at)",
    )
    .eq("id", id)
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    throw new Error(
      "This booking belongs to another hotel. Switch workspace at the top of the screen to open it.",
    );
  return data as unknown as BookingDetail;
}

function BookingDetailPage() {
  const params = useParams({ from: "/_authenticated/bookings/$id" });
  if (params.id === "new") return <NewBookingForm />;
  return <BookingDetail id={params.id} />;
}

function BookingDetail({ id }: { id: string }) {
  const { activeHotel, can } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const { data: booking, refetch } = useSuspenseQuery({
    queryKey: ["booking", id, hotelId],
    queryFn: () => fetchBooking(id, hotelId),
  });
  const currency = booking.hotels?.currency ?? activeHotel?.currency ?? "GHS";

  const confirm = useServerFn(confirmBooking);
  const checkIn = useServerFn(checkInBooking);
  const checkOut = useServerFn(checkOutBooking);
  const cancel = useServerFn(cancelBooking);
  const addCharge = useServerFn(addFolioCharge);
  const payCash = useServerFn(recordCashPayment);
  const payMomo = useServerFn(initializePaystackPayment);
  const occCheckIn = useServerFn(checkInOccupancy);
  const occCheckOut = useServerFn(checkOutOccupancy);

  const [busy, setBusy] = useState(false);
  const [charges, setCharges] = useState([
    { id: "charge-1", category: "food", description: "", quantity: 1, unitPrice: 0 },
  ]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const preview_ = useServerFn(previewCheckOut);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [preview, setPreview] = useState<CheckOutPreview | null>(null);

  const balance = Number(booking.total) - Number(booking.amount_paid);
  const closed = ["checked_out", "cancelled"].includes(booking.status);
  const fullyPaid = balance <= 0.009;
  const balanceText = fullyPaid
    ? "Fully paid — no outstanding balance"
    : `Outstanding ${money(balance, currency)}`;
  const chargeLabel = charges.length === 1 ? "Post charge" : `Post ${charges.length} charges`;

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

  const addChargeItem = () =>
    setCharges((prev) => [
      ...prev,
      {
        id: `charge-${Date.now()}-${prev.length}`,
        category: "food",
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);

  const removeChargeItem = (id: string) => setCharges((prev) => prev.filter((c) => c.id !== id));

  const updateChargeItem = (
    id: string,
    patch: Partial<{ category: string; description: string; quantity: number; unitPrice: number }>,
  ) => setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const submitCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = charges
      .filter((c) => c.description.trim().length > 0)
      .map((c) => ({
        category: c.category,
        description: c.description.trim(),
        quantity: c.quantity,
        unitPrice: c.unitPrice,
      }));
    if (items.length === 0) {
      toast.error("Add at least one charge line before posting");
      return;
    }
    await run("Charges posted to folio", async () => {
      await addCharge({ data: { bookingId: booking.id, items } });
      setCharges([
        {
          id: `charge-${Date.now()}`,
          category: "food",
          description: "",
          quantity: 1,
          unitPrice: 0,
        },
      ]);
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

  const submitMomo2 = async () => {};

  const openCheckOut = async () => {
    setBusy(true);
    try {
      const result = await preview_({ data: { bookingId: booking.id } });
      setPreview(result);
      setRefundMethod(result.netRefund > 0.009 ? "cash" : "none");
      setCheckoutOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not prepare check-out");
    } finally {
      setBusy(false);
    }
  };

  const confirmCheckOut = async () => {
    await run("Guest checked out", async () => {
      await checkOut({ data: { bookingId: booking.id, refundMethod } });
      setCheckoutOpen(false);
      setPreview(null);
    });
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
              <Button
                disabled={busy}
                onClick={() =>
                  run("Guest checked in", () => checkIn({ data: { bookingId: booking.id } }))
                }
              >
                Check in
              </Button>
            ) : null}
            {booking.status === "checked_in" ? (
              <Button disabled={busy} onClick={() => void openCheckOut()}>
                {busy ? "Working…" : "Check out"}
              </Button>
            ) : null}
            {!closed && booking.status !== "checked_in" ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Cancel this booking?")) return;
                  void run("Booking cancelled", () =>
                    cancel({ data: { bookingId: booking.id, reason: "Cancelled at front desk" } }),
                  );
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
                  <p className="text-sm text-muted-foreground">
                    {booking.hotels?.phone} {booking.hotels?.email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="kinetic-label text-xs text-foreground">Invoice</p>
                  <p className="font-display font-semibold text-foreground">{booking.reference}</p>
                  <p className="text-xs text-muted-foreground">{dateTime(booking.created_at)}</p>
                  <div className="mt-1 flex justify-end">
                    <StatusBadge status={booking.status} />
                  </div>
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
                  <p className="font-medium text-foreground">
                    {shortDate(booking.check_in)}{" "}
                    {booking.check_out ? `→ ${shortDate(booking.check_out)}` : "· open-ended"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.pricing_model === "per_stay"
                      ? `${booking.guests_count} occupant(s) · flat fee per stay`
                      : `${booking.nights ?? 0} night(s) · ${booking.guests_count} guest(s)`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.room_types?.name}{" "}
                    {booking.rooms?.room_number ? `· Room ${booking.rooms.room_number}` : ""}
                  </p>
                </div>
              </div>

              {booking.channel_connection_id ? (
                <div className="mt-4 border-[3px] border-ink bg-amber/20 p-3">
                  <p className="kinetic-label text-[10px] text-muted-foreground">
                    Came from a travel site
                  </p>
                  <p className="mt-1 font-medium text-foreground">
                    {(booking.channel_connections?.provider ?? "other") === "booking_com"
                      ? "Booking.com"
                      : titleCase((booking.channel_connections?.provider ?? "other").replace(/_/g, " "))}
                    {booking.channel_connections?.label
                      ? ` · ${booking.channel_connections.label}`
                      : ""}
                    {" — "}
                    {booking.channel_connections?.status === "active"
                      ? "syncing"
                      : titleCase(booking.channel_connections?.status ?? "linked")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {booking.channel_bookings?.[0]?.summary
                      ? `${booking.channel_bookings[0].summary} · `
                      : ""}
                    {booking.channel_connections?.last_sync_at
                      ? `Last checked ${dateTime(booking.channel_connections.last_sync_at)}`
                      : "Not synced yet"}
                  </p>
                  {booking.channel_connections?.last_sync_ok === false &&
                  booking.channel_connections?.last_sync_message ? (
                    <p className="mt-1 text-sm font-medium text-destructive">
                      {booking.channel_connections.last_sync_message}
                    </p>
                  ) : null}
                </div>
              ) : null}


              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">Item</th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">
                      Qty
                    </th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">
                      Rate
                    </th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 text-foreground">
                      {booking.pricing_model === "per_stay"
                        ? `Accommodation — ${booking.guests_count} per-stay fee${booking.guests_count === 1 ? "" : "s"}`
                        : `Accommodation (${booking.nights ?? 0} nights)`}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {booking.pricing_model === "per_stay"
                        ? booking.guests_count
                        : (booking.nights ?? 0)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground">
                      {money(booking.room_rate, currency)}
                    </td>
                    <td className="py-2 text-right text-foreground">
                      {booking.pricing_model === "per_stay"
                        ? money(Number(booking.room_rate) * Number(booking.guests_count), currency)
                        : money(Number(booking.room_rate) * Number(booking.nights ?? 0), currency)}
                    </td>
                  </tr>
                  {(booking.folio_items ?? []).map((item) => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="py-2 text-foreground">
                        {item.description}{" "}
                        <span className="text-xs text-muted-foreground">
                          · {titleCase(item.category)}
                        </span>
                      </td>
                      <td className="py-2 text-right text-muted-foreground">{item.quantity}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {money(item.unit_price, currency)}
                      </td>
                      <td className="py-2 text-right text-foreground">
                        {money(item.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <dl className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
                <Row label="Service charge" value={money(booking.service_charge, currency)} />
                <Row label="Tax" value={money(booking.tax_amount, currency)} />
                {Number(booking.discount) > 0 ? (
                  <Row label="Discount" value={`- ${money(booking.discount, currency)}`} />
                ) : null}
                <div className="flex justify-between border-t-[3px] border-ink pt-2">
                  <dt className="kinetic-label text-xs text-foreground">Total</dt>
                  <dd className="font-display font-extrabold text-foreground">
                    {money(booking.total, currency)}
                  </dd>
                </div>
                <Row label="Paid" value={money(booking.amount_paid, currency)} />
                <div className="flex justify-between">
                  <dt className="kinetic-label text-xs text-foreground">Balance</dt>
                  <dd
                    className={
                      balance > 0.009
                        ? "font-semibold text-destructive"
                        : "font-semibold text-foreground"
                    }
                  >
                    {money(balance, currency)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="kinetic-label text-xs text-foreground">Occupants</h3>
              {(booking.occupancies ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No occupants recorded for this stay.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {booking.occupancies.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {o.guests?.full_name ?? "Unknown guest"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {money(o.price, currency)}
                          {o.bed_number ? ` · ${o.bed_number}` : ""}
                          {o.checked_in_at ? ` · in ${dateTime(o.checked_in_at)}` : ""}
                          {o.checked_out_at ? ` · out ${dateTime(o.checked_out_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        {o.status === "reserved" && !closed ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              run("Occupant checked in", () =>
                                occCheckIn({ data: { occupancyId: o.id } }),
                              )
                            }
                          >
                            Check in
                          </Button>
                        ) : null}
                        {o.status === "checked_in" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              run("Occupant checked out", () =>
                                occCheckOut({ data: { occupancyId: o.id } }),
                              )
                            }
                          >
                            Check out
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    <div
                      key={p.id}
                      className="flex items-center justify-between border-b border-border pb-2 text-sm"
                    >
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
                <p className="mt-1 text-sm text-muted-foreground">{balanceText}</p>
                <div className="mt-3 space-y-3">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Amount"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    disabled={closed || fullyPaid}
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={busy || closed || fullyPaid}
                      onClick={submitCash}
                    >
                      <Wallet className="mr-1 size-4" /> Cash
                    </Button>
                    <Button
                      className="flex-1"
                      variant="outline"
                      disabled={busy || closed || fullyPaid}
                      onClick={submitMomo2}
                    >
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
                {charges.map((c, idx) => (
                  <div key={c.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">Item {idx + 1}</p>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline hover:text-destructive"
                        onClick={() => removeChargeItem(c.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-2">
                      <Label htmlFor={`charge-category-${c.id}`}>Category</Label>
                      <select
                        id={`charge-category-${c.id}`}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={c.category}
                        onChange={(e) => updateChargeItem(c.id, { category: e.target.value })}
                      >
                        {FOLIO_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {titleCase(cat)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-2">
                      <Label htmlFor={`charge-desc-${c.id}`}>Description</Label>
                      <Input
                        id={`charge-desc-${c.id}`}
                        required
                        value={c.description}
                        onChange={(e) => updateChargeItem(c.id, { description: e.target.value })}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor={`charge-qty-${c.id}`}>Qty</Label>
                        <Input
                          id={`charge-qty-${c.id}`}
                          type="number"
                          min={1}
                          value={c.quantity}
                          onChange={(e) =>
                            updateChargeItem(c.id, {
                              quantity: parseInt(e.target.value || "1", 10),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor={`charge-price-${c.id}`}>Unit price</Label>
                        <Input
                          id={`charge-price-${c.id}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={c.unitPrice}
                          onChange={(e) =>
                            updateChargeItem(c.id, { unitPrice: parseFloat(e.target.value || "0") })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={busy || closed}
                  onClick={addChargeItem}
                >
                  <Plus className="mr-1 size-4" /> Add item
                </Button>
                <Button type="submit" className="w-full" disabled={busy || closed}>
                  <Plus className="mr-1 size-4" /> {chargeLabel}
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

      <Dialog open={checkoutOpen} onOpenChange={(open) => !busy && setCheckoutOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check out {booking.guests?.full_name ?? "guest"}</DialogTitle>
            <DialogDescription>
              {preview?.early
                ? "This guest is leaving before their last night."
                : "Confirm the guest is leaving and settle anything outstanding."}
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <dl className="space-y-1 text-sm">
              <Row label="Nights not used" value={String(preview.unusedNights)} />
              <Row label="Value of unused nights" value={money(preview.unusedValue, currency)} />
              <Row label="Revised total" value={money(preview.adjustedTotal, currency)} />
              <Row label="Still to pay" value={money(preview.outstanding, currency)} />
              <Row label="Refund due" value={money(preview.grossRefund, currency)} />
              <Row label="Early departure fee kept" value={money(preview.withheld, currency)} />
              <div className="flex justify-between border-t-[2px] border-ink pt-1 font-semibold">
                <dt>Refund to guest</dt>
                <dd>{money(preview.netRefund, currency)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Checking the stay…</p>
          )}

          {preview && preview.outstanding > 0.009 && (
            <p className="text-sm font-semibold text-destructive">
              Take the outstanding {money(preview.outstanding, currency)} before checking out.
            </p>
          )}

          {preview && preview.netRefund > 0.009 && (
            <div>
              <Label htmlFor="refundMethod">How is the refund paid?</Label>
              <select
                id="refundMethod"
                className="mt-1 w-full border-[2px] border-ink bg-card px-3 py-2 text-sm"
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
              >
                <option value="cash">Cash at the front desk</option>
                <option value="mobile_money">Back to Mobile Money</option>
                <option value="none">Don't refund yet</option>
              </select>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setCheckoutOpen(false)}>
              Not yet
            </Button>
            <Button
              disabled={busy || !preview || preview.outstanding > 0.009}
              onClick={() => void confirmCheckOut()}
            >
              {busy ? "Working…" : "Check out guest"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [rooms, setRooms] = useState<
    {
      id: string;
      room_number: string;
      room_type_id: string | null;
      room_types: { name: string } | null;
    }[]
  >([]);
  const [roomTypes, setRoomTypes] = useState<
    {
      id: string;
      name: string;
      base_price: number;
      per_stay_price: number | null;
      pricing_model: string;
      max_guests: number;
    }[]
  >([]);
  const [guests, setGuests] = useState<
    { id: string; full_name: string; phone: string | null; email: string | null }[]
  >([]);
  const [occupants, setOccupants] = useState([{ fullName: "", phone: "", email: "" }]);
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
        supabase
          .from("guests")
          .select("id, full_name, phone, email")
          .eq("hotel_id", activeHotel.id)
          .order("full_name")
          .limit(100),
        supabase
          .from("room_types")
          .select("id, name, base_price, per_stay_price, pricing_model, max_guests")
          .eq("hotel_id", activeHotel.id)
          .eq("is_active", true)
          .order("name"),
      ]);
      setRooms((roomsRes.data ?? []) as unknown as typeof rooms);
      setGuests((guestsRes.data ?? []) as unknown as typeof guests);
      setRoomTypes((typesRes.data ?? []) as unknown as typeof roomTypes);
    };
    void loadLookups();
  }, [activeHotel]);

  const selectedType = roomTypes.find((rt) => rt.id === form.roomTypeId);
  const isPerStay = selectedType?.pricing_model === "per_stay";

  const setOccupant = (index: number, patch: Partial<{ fullName: string; phone: string; email: string }>) =>
    setOccupants((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));

  const addOccupant = () => {
    const max = selectedType?.max_guests ?? 20;
    if (occupants.length >= max) {
      toast.error(`This room type takes up to ${max} occupants`);
      return;
    }
    setOccupants((prev) => [...prev, { fullName: "", phone: "", email: "" }]);
  };

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
    const draftOccupants = isPerStay
      ? occupants
      : [{ fullName: form.fullName, phone: form.phone, email: form.email }];
    if (draftOccupants.some((o) => o.fullName.trim().length < 2)) {
      toast.error("Add a name for every occupant");
      return;
    }
    if (!isPerStay && !form.checkOut) {
      toast.error("Check-out is required for per-night stays");
      return;
    }
    const toGuest = (o: { fullName: string; phone: string; email: string }) => ({
      full_name: o.fullName.trim(),
      phone: o.phone.trim() || undefined,
      email: o.email.trim() || undefined,
    });
    setLoading(true);
    try {
      const result = await create({
        data: {
          hotelId: activeHotel.id,
          guest: {
            id: form.guestId || undefined,
            ...toGuest(draftOccupants[0]!),
          },
          occupants: draftOccupants.map(toGuest),
          roomId: form.roomId || undefined,
          roomTypeId: form.roomTypeId || undefined,
          checkIn: form.checkIn,
          checkOut: isPerStay ? (form.checkOut || undefined) : form.checkOut,
          guestsCount: draftOccupants.length,
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
              <h3 className="kinetic-label text-xs text-foreground border-b-[3px] border-ink pb-2">
                Guests
              </h3>
            </div>
            {isPerStay ? (
              <div className="sm:col-span-2 space-y-3">
                {occupants.map((o, idx) => (
                  <div key={idx} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">
                        Occupant {idx + 1} — pays the room&apos;s flat per-stay fee
                      </p>
                      {occupants.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-muted-foreground underline hover:text-destructive"
                          onClick={() => setOccupants((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mt-2 grid gap-3 sm:grid-cols-3">
                      <Input
                        aria-label={`Occupant ${idx + 1} name`}
                        placeholder="Full name"
                        required
                        value={o.fullName}
                        onChange={(e) => setOccupant(idx, { fullName: e.target.value })}
                      />
                      <Input
                        aria-label={`Occupant ${idx + 1} phone`}
                        placeholder="Phone (optional)"
                        value={o.phone}
                        onChange={(e) => setOccupant(idx, { phone: e.target.value })}
                      />
                      <Input
                        aria-label={`Occupant ${idx + 1} email`}
                        type="email"
                        placeholder="Email (optional)"
                        value={o.email}
                        onChange={(e) => setOccupant(idx, { email: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addOccupant}>
                  <Plus className="mr-1 size-4" /> Add another occupant
                </Button>
              </div>
            ) : (
              <>
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
                      <option key={g.id} value={g.id}>
                        {g.full_name} {g.phone ? `· ${g.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="fullName">Guest name</Label>
                  <Input
                    id="fullName"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <h3 className="kinetic-label text-xs text-foreground border-b-[3px] border-ink pb-2">
                Room & stay
              </h3>
            </div>
            <div>
              <Label htmlFor="roomId">Room</Label>
              <select
                id="roomId"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.roomId}
                onChange={(e) => {
                  const room = rooms.find((r) => r.id === e.target.value);
                  setForm((p) => ({
                    ...p,
                    roomId: e.target.value,
                    roomTypeId: room?.room_type_id ?? p.roomTypeId,
                  }));
                }}
              >
                <option value="">Unassigned (choose room type)</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} · {r.room_types?.name}
                  </option>
                ))}
              </select>
              {rooms.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No free rooms — pick a room type instead.
                </p>
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
                    {rt.name}{" "}
                    ·{" "}
                    {rt.pricing_model === "per_stay"
                      ? `${money(rt.per_stay_price ?? 0, activeHotel?.currency)} per stay`
                      : `${money(rt.base_price, activeHotel?.currency)} / night`}
                  </option>
                ))}
              </select>
              {isPerStay ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Flat fee per person for the whole stay — no nightly rate.
                </p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="checkIn">Check in</Label>
              <Input
                id="checkIn"
                type="date"
                required
                value={form.checkIn}
                onChange={(e) => setForm((p) => ({ ...p, checkIn: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="checkOut">
                Check out {isPerStay ? "(optional — leave blank for open-ended stays)" : ""}
              </Label>
              <Input
                id="checkOut"
                type="date"
                required={!isPerStay}
                value={form.checkOut}
                onChange={(e) => setForm((p) => ({ ...p, checkOut: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="note">Notes</Label>
              <Input
                id="note"
                value={form.note}
                onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create booking"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
