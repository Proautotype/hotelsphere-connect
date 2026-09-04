import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { DiscoveryLayout } from "@/components/discovery/DiscoveryLayout";
import { getPublicBooking, startPublicPayment } from "@/lib/discovery.functions";
import { Button } from "@/components/ui/button";
import { money, shortDate, dateTime, titleCase } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/booking/$reference")({
  loader: async ({ params }) => {
    const result = await getPublicBooking({ data: { reference: params.reference } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ params }) => ({
    meta: [
      { title: `Booking ${params.reference} — Custard Hotels` },
      { name: "description", content: "Your Custard Hotels booking summary, balance and payment status." },
      { property: "og:title", content: `Booking ${params.reference} — Custard Hotels` },
      { property: "og:description", content: "Your Custard Hotels booking summary, balance and payment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  notFoundComponent: () => (
    <DiscoveryLayout>
      <p className="ink bg-card p-6 font-medium">We couldn't find that booking reference.</p>
    </DiscoveryLayout>
  ),
  errorComponent: () => (
    <DiscoveryLayout>
      <p className="ink bg-card p-6 font-medium">We couldn't load this booking. Please refresh.</p>
    </DiscoveryLayout>
  ),
  component: BookingPage,
});

function BookingPage() {
  const { booking, payments } = Route.useLoaderData();
  const { reference } = Route.useParams();
  const [busy, setBusy] = useState(false);

  const hotel = booking.hotels as unknown as {
    name: string;
    slug: string;
    city: string | null;
    currency: string;
    phone: string | null;
    email: string | null;
    check_in_time: string;
    check_out_time: string;
    cancellation_policy: string | null;
  };
  const guest = booking.guests as unknown as { full_name: string; email: string | null } | null;
  const roomType = booking.room_types as unknown as { name: string } | null;
  const outstanding = Number(booking.total) - Number(booking.amount_paid);

  const pay = async () => {
    setBusy(true);
    try {
      const result = await startPublicPayment({ data: { reference, origin: window.location.origin } });
      if (result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
        return;
      }
      toast.info(
        result.reason === "paid" ? "This booking is fully paid." : "Online payment isn't available for this hotel yet — pay at the front desk.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed to start");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DiscoveryLayout>
      <div className="ink shadow-hard bg-card p-6 sm:p-8">
        <p className="ink inline-block -rotate-1 bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground">
          Booking {booking.reference}
        </p>
        <h1 className="mt-4 font-display text-3xl font-extrabold uppercase tracking-tighter sm:text-4xl">{hotel.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hotel.city} · {titleCase(String(booking.status).replace(/_/g, " "))}
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-[2px] border-ink p-3">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Guest</dt>
            <dd className="mt-1 font-medium">{guest?.full_name}</dd>
          </div>
          <div className="border-[2px] border-ink p-3">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Room</dt>
            <dd className="mt-1 font-medium">{roomType?.name}</dd>
          </div>
          <div className="border-[2px] border-ink p-3">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stay</dt>
            <dd className="mt-1 font-medium">
              {shortDate(booking.check_in)} → {shortDate(booking.check_out)}
            </dd>
          </div>
          <div className="border-[2px] border-ink p-3">
            <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Guests</dt>
            <dd className="mt-1 font-medium">{booking.guests_count}</dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="border-[2px] border-ink p-4">
            <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">Charges</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Rooms ({booking.nights} nights)</dt>
                <dd>{money(Number(booking.room_rate) * Number(booking.nights), hotel.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{money(booking.tax_amount, hotel.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Service charge</dt>
                <dd>{money(booking.service_charge, hotel.currency)}</dd>
              </div>
              <div className="flex justify-between border-t-[2px] border-ink pt-1 font-bold">
                <dt>Total</dt>
                <dd>{money(booking.total, hotel.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid</dt>
                <dd>{money(booking.amount_paid, hotel.currency)}</dd>
              </div>
              <div className="flex justify-between font-bold text-primary">
                <dt>Balance</dt>
                <dd>{money(outstanding, hotel.currency)}</dd>
              </div>
            </dl>
            {outstanding > 0 && (
              <Button className="mt-4 w-full" disabled={busy} onClick={pay}>
                {busy ? "Starting…" : `Pay ${money(outstanding, hotel.currency)}`}
              </Button>
            )}
          </div>

          <div className="border-[2px] border-ink p-4">
            <h2 className="font-display text-lg font-extrabold uppercase tracking-tight">Payments</h2>
            {payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {payments.map((p, i) => (
                  <li key={`${p.receipt_number ?? "pay"}-${i}`} className="flex items-center justify-between border-b border-border pb-2">
                    <span>
                      {money(p.amount, hotel.currency)} · {titleCase(String(p.method).replace(/_/g, " "))}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {titleCase(String(p.status))} {p.paid_at ? `· ${dateTime(p.paid_at)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              Check-in from {String(hotel.check_in_time).slice(0, 5)}, check-out by {String(hotel.check_out_time).slice(0, 5)}. Questions?
              {hotel.phone ? ` Call ${hotel.phone}.` : hotel.email ? ` Email ${hotel.email}.` : ""}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/hotels/$slug" params={{ slug: hotel.slug }} className="ink kinetic-press shadow-hard bg-card px-4 py-2 text-sm font-bold">
            Back to hotel
          </Link>
          <Link to="/discover" className="ink kinetic-press shadow-hard bg-amber px-4 py-2 text-sm font-bold text-amber-foreground">
            Find another stay
          </Link>
        </div>
      </div>
    </DiscoveryLayout>
  );
}
