import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DiscoveryLayout } from "@/components/discovery/DiscoveryLayout";
import { listPublicHotels, type DiscoveryHotel } from "@/lib/discovery.functions";
import { money, titleCase } from "@/lib/format";
import { MapPin, Search, Star } from "lucide-react";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [
      { title: "Find & Book Hotels in Ghana — Custard Hotels" },
      {
        name: "description",
        content:
          "Browse verified hotels, guesthouses and resorts across Ghana. Compare rooms and rates, then book instantly and pay with Mobile Money.",
      },
      { property: "og:title", content: "Find & Book Hotels in Ghana — Custard Hotels" },
      {
        property: "og:description",
        content: "Compare rooms and rates at hotels in Accra, Kumasi, Cape Coast and beyond. Book instantly, pay with Mobile Money.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => listPublicHotels({ data: {} }),
  errorComponent: () => (
    <DiscoveryLayout>
      <p className="ink bg-card p-6 font-medium">We couldn't load hotels right now. Please refresh in a moment.</p>
    </DiscoveryLayout>
  ),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { hotels, cities, types } = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const cap = maxPrice ? Number(maxPrice) : null;
    return hotels.filter((h: DiscoveryHotel) => {
      if (q && !`${h.name} ${h.city ?? ""} ${h.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (city && h.city !== city) return false;
      if (type && h.hotel_type !== type) return false;
      if (cap !== null && (h.from_price === null || h.from_price > cap)) return false;
      return true;
    });
  }, [hotels, search, city, type, maxPrice]);

  return (
    <DiscoveryLayout>
      <section className="animate-rise">
        <p className="ink inline-block -rotate-1 bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-foreground">
          {hotels.length} verified stays
        </p>
        <h1 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[0.95] tracking-tighter sm:text-5xl lg:text-6xl">
          Find a room.
          <br />
          Book it in a minute.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">
          Real availability from hotels running on Custard. Pay with Mobile Money now or settle at the front desk.
        </p>
      </section>

      <section className="ink shadow-hard mt-8 grid gap-3 bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 border-[2px] border-ink px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Hotel or city"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search hotels"
          />
        </label>
        <select
          className="border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="Filter by city"
        >
          <option value="">All cities</option>
          {cities.map((c: string) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter by property type"
        >
          <option value="">All property types</option>
          {types.map((t: string) => (
            <option key={t} value={t}>
              {titleCase(t)}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          className="border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
          placeholder="Max nightly price"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          aria-label="Maximum nightly price"
        />
      </section>

      {filtered.length === 0 ? (
        <p className="ink mt-8 border-dashed bg-card p-8 text-center font-medium">No stays match those filters yet.</p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((hotel: DiscoveryHotel) => (
            <Link
              key={hotel.id}
              to="/$hotelSlug"
              params={{ hotelSlug: hotel.slug }}
              className="ink kinetic-tilt shadow-hard flex flex-col bg-card"
            >
              <div className="relative h-44 border-b-[3px] border-ink bg-sand">
                {hotel.cover_url ? (
                  <img src={hotel.cover_url} alt={`${hotel.name} in ${hotel.city ?? "Ghana"}`} loading="lazy" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center font-display text-2xl font-extrabold uppercase tracking-tighter text-sand-foreground">
                    {hotel.name.slice(0, 14)}
                  </div>
                )}
                {hotel.is_featured && (
                  <span className="ink absolute left-3 top-3 flex items-center gap-1 bg-amber px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-foreground">
                    <Star className="size-3" aria-hidden /> Featured
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h2 className="font-display text-xl font-extrabold uppercase tracking-tight">{hotel.name}</h2>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden />
                  {hotel.city ?? "Ghana"}
                  {hotel.hotel_type ? ` · ${titleCase(hotel.hotel_type)}` : ""}
                </p>
                <p className="mt-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{hotel.description}</p>
                <div className="mt-4 flex items-end justify-between border-t-[2px] border-ink pt-3">
                  <span className="text-sm text-muted-foreground">
                    {hotel.show_prices && hotel.from_price !== null ? "From" : `${hotel.room_type_count} room types`}
                  </span>
                  {hotel.show_prices && hotel.from_price !== null && (
                    <span className="font-display text-lg font-extrabold">{money(hotel.from_price, hotel.currency)}<span className="text-xs font-medium text-muted-foreground">/night</span></span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DiscoveryLayout>
  );
}
