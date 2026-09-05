import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Phone } from "lucide-react";

export interface HotelBrand {
  name: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  cancellation_policy: string | null;
}

// The hotel's own storefront chrome. Deliberately free of Custard navigation so
// the page reads as the hotel's own website.
export function HotelShell({ hotel, children }: { hotel: HotelBrand; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b-[3px] border-ink bg-sand">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            {hotel.logo_url ? (
              <img src={hotel.logo_url} alt={`${hotel.name} logo`} className="ink size-12 bg-card object-cover" />
            ) : null}
            <span className="font-display text-xl font-extrabold uppercase leading-none tracking-tighter sm:text-2xl">
              {hotel.name}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {hotel.phone && (
              <a href={`tel:${hotel.phone}`} className="flex items-center gap-1 text-sm font-medium hover:text-primary">
                <Phone className="size-4" aria-hidden /> {hotel.phone}
              </a>
            )}
            <a href="#book" className="ink kinetic-press shadow-hard bg-amber px-4 py-2 text-sm font-bold text-amber-foreground">
              Book a room
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-8 sm:px-8 lg:px-12">{children}</main>

      <footer className="border-t-[3px] border-ink bg-ink py-10 text-background">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 sm:grid-cols-3 sm:px-8 lg:px-12">
          <div>
            <p className="font-display text-xl font-extrabold uppercase leading-none tracking-tighter">{hotel.name}</p>
            <p className="mt-2 text-sm opacity-80">{hotel.address ?? hotel.city}</p>
          </div>
          <div className="text-sm opacity-80">
            {hotel.phone && <p>{hotel.phone}</p>}
            {hotel.email && <p>{hotel.email}</p>}
            {hotel.check_in_time && hotel.check_out_time && (
              <p>
                Check-in {String(hotel.check_in_time).slice(0, 5)} · check-out {String(hotel.check_out_time).slice(0, 5)}
              </p>
            )}
          </div>
          <div className="text-sm opacity-80">
            {hotel.cancellation_policy && <p>{hotel.cancellation_policy}</p>}
            <p className="mt-3 text-xs">
              Powered by{" "}
              <Link to="/discover" className="underline">
                Custard Hotels
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
