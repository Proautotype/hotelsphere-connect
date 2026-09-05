import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HotelShell } from "@/components/discovery/HotelShell";
import { getPublicHotel, createPublicBooking, startPublicPayment } from "@/lib/discovery.functions";
import { money, titleCase, today } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, Phone, Mail, Clock, Users, BedDouble } from "lucide-react";

export type HotelSiteData = NonNullable<Awaited<ReturnType<typeof getPublicHotel>>>;

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Rendered both at the hotel's short address (/:hotelSlug) and at "/" when the
// request arrives on a hotel subdomain.
export function HotelSite({ initial, slug }: { initial: HotelSiteData; slug: string }) {
  const navigate = useNavigate();

  const start = today();
  const [checkIn, setCheckIn] = useState(start);
  const [checkOut, setCheckOut] = useState(addDays(start, 1));
  const [guestsCount, setGuestsCount] = useState(1);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["discovery", "hotel", slug, checkIn, checkOut],
    queryFn: () => getPublicHotel({ data: { slug, checkIn, checkOut } }),
    initialData: initial,
    enabled: checkOut > checkIn,
  });

  const hotel = data?.hotel ?? initial.hotel;
  const roomTypes = data?.roomTypes ?? initial.roomTypes;
  const selected = roomTypes.find((r) => r.id === roomTypeId) ?? null;

  const submit = async () => {
    if (!selected) {
      toast.error("Choose a room first");
      return;
    }
    setBusy(true);
    try {
      const booking = await createPublicBooking({
        data: { slug, roomTypeId: selected.id, checkIn, checkOut, guestsCount, fullName, email, phone, notes },
      });
      const payment = await startPublicPayment({ data: { reference: booking.reference, origin: window.location.origin } });
      if (payment.authorizationUrl) {
        window.location.href = payment.authorizationUrl;
        return;
      }
      toast.success(`Booking ${booking.reference} received`);
      navigate({ to: "/booking/$reference", params: { reference: booking.reference } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <HotelShell hotel={hotel}>
      <div className="ink shadow-hard overflow-hidden bg-card">
        <div className="h-56 border-b-[3px] border-ink bg-sand sm:h-72">
          {hotel.cover_url ? (
            <img src={hotel.cover_url} alt={`${hotel.name} exterior`} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center font-display text-4xl font-extrabold uppercase tracking-tighter text-sand-foreground">
              {hotel.name}
            </div>
          )}
        </div>
        <div className="p-5 sm:p-8">
          <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tighter sm:text-5xl">{hotel.name}</h1>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {hotel.address ?? hotel.city}
            </span>
            {hotel.phone && (
              <span className="flex items-center gap-1">
                <Phone className="size-4" aria-hidden /> {hotel.phone}
              </span>
            )}
            {hotel.email && (
              <span className="flex items-center gap-1">
                <Mail className="size-4" aria-hidden /> {hotel.email}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> Check-in {String(hotel.check_in_time).slice(0, 5)} · out{" "}
              {String(hotel.check_out_time).slice(0, 5)}
            </span>
          </div>
          <p className="mt-5 max-w-3xl text-base text-muted-foreground">{hotel.description}</p>
          {hotel.amenities?.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-2">
              {hotel.amenities.map((a: string) => (
                <li key={a} className="border-[2px] border-ink px-2 py-1 text-xs font-bold uppercase tracking-widest">
                  {titleCase(a)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-tight">Rooms &amp; rates</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest">
              Check in
              <input
                type="date"
                min={start}
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1));
                }}
                className="border-[2px] border-ink bg-transparent px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-widest">
              Check out
              <input
                type="date"
                min={addDays(checkIn, 1)}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="border-[2px] border-ink bg-transparent px-3 py-2 text-sm font-normal normal-case tracking-normal"
              />
            </label>
          </div>

          <div className="mt-5 space-y-4">
            {roomTypes.length === 0 && <p className="ink bg-card p-6 text-sm">This hotel hasn't published rooms yet.</p>}
            {roomTypes.map((room) => {
              const soldOut = room.rooms_available === 0;
              const active = roomTypeId === room.id;
              return (
                <article
                  key={room.id}
                  className={`ink bg-card p-5 ${active ? "shadow-hard-teal" : "shadow-hard"} ${soldOut ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-display text-xl font-extrabold uppercase tracking-tight">{room.name}</h3>
                      <p className="mt-1 flex flex-wrap gap-x-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="size-4" aria-hidden /> Up to {room.max_guests}
                        </span>
                        <span className="flex items-center gap-1">
                          <BedDouble className="size-4" aria-hidden /> {room.bed_count} × {room.bed_type}
                        </span>
                        <span>{soldOut ? "Sold out for these dates" : `${room.rooms_available} available`}</span>
                      </p>
                      <p className="mt-2 max-w-xl text-sm text-muted-foreground">{room.description}</p>
                    </div>
                    <div className="text-right">
                      {hotel.show_prices && (
                        <>
                          <p className="font-display text-2xl font-extrabold">{money(room.base_price, hotel.currency)}</p>
                          <p className="text-xs text-muted-foreground">per night</p>
                          <p className="mt-2 text-sm font-medium">
                            {money(room.quote.total, hotel.currency)} total · {room.quote.nights} night
                            {room.quote.nights === 1 ? "" : "s"}
                          </p>
                        </>
                      )}
                      <Button
                        className="mt-3"
                        size="sm"
                        disabled={soldOut}
                        variant={active ? "secondary" : "default"}
                        onClick={() => setRoomTypeId(room.id)}
                      >
                        {active ? "Selected" : "Select room"}
                      </Button>
                    </div>
                  </div>
                  {room.images && room.images.length > 0 && (
                    <ul className="mt-4 grid grid-cols-3 gap-2">
                      {room.images.slice(0, 3).map((src, i) => (
                        <li key={src} className="ink overflow-hidden bg-muted">
                          <img
                            src={src}
                            alt={`${room.name} at ${hotel.name} — photo ${i + 1}`}
                            loading="lazy"
                            className="aspect-[4/3] size-full object-cover"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside id="book" className="lg:sticky lg:top-6 lg:self-start">
          <div className="ink shadow-hard-amber bg-card p-5">
            <h2 className="font-display text-xl font-extrabold uppercase tracking-tight">Book your stay</h2>
            {!hotel.accept_online_bookings ? (
              <p className="mt-3 text-sm text-muted-foreground">
                This hotel takes bookings by phone only. Call {hotel.phone ?? hotel.email} to reserve.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="border-[2px] border-ink p-3 text-sm">
                  {selected ? (
                    <>
                      <p className="font-bold">{selected.name}</p>
                      <p className="text-muted-foreground">
                        {checkIn} → {checkOut} · {selected.quote.nights} night{selected.quote.nights === 1 ? "" : "s"}
                      </p>
                      <dl className="mt-2 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Rooms</dt>
                          <dd>{money(selected.quote.subtotal, hotel.currency)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Tax</dt>
                          <dd>{money(selected.quote.tax, hotel.currency)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Service charge</dt>
                          <dd>{money(selected.quote.serviceCharge, hotel.currency)}</dd>
                        </div>
                        <div className="flex justify-between border-t-[2px] border-ink pt-1 text-sm font-bold">
                          <dt>Total</dt>
                          <dd>{money(selected.quote.total, hotel.currency)}</dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Pick a room to see your total.</p>
                  )}
                </div>

                <input
                  className="w-full border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  aria-label="Full name"
                />
                <input
                  type="email"
                  className="w-full border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email"
                />
                <input
                  className="w-full border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
                  placeholder="Phone (Mobile Money number)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-label="Phone number"
                />
                <input
                  type="number"
                  min="1"
                  max={selected?.max_guests ?? 10}
                  className="w-full border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
                  value={guestsCount}
                  onChange={(e) => setGuestsCount(Number(e.target.value) || 1)}
                  aria-label="Number of guests"
                />
                <textarea
                  className="w-full border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Any requests? (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  aria-label="Requests"
                />
                <Button className="w-full" disabled={busy || !selected || !fullName || !email || !phone} onClick={submit}>
                  {busy ? "Reserving…" : "Book & pay"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  You'll be taken to Mobile Money / card checkout. If online payment isn't available you can settle at the front
                  desk.
                </p>
              </div>
            )}
            {hotel.cancellation_policy && (
              <p className="mt-4 border-t-[2px] border-ink pt-3 text-xs text-muted-foreground">{hotel.cancellation_policy}</p>
            )}
          </div>
        </aside>
      </div>
    </HotelShell>
  );
}
