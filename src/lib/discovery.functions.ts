// Public discovery module — self-contained server functions for the guest-facing
// hotel discovery site. Nothing here depends on the hotel dashboard, so the whole
// discovery surface (these functions + src/routes/discover*, src/routes/hotels.$slug,
// src/routes/booking.$reference) can be lifted into its own app later.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const round2 = (value: number) => Math.round(value * 100) / 100;

const ACTIVE_BOOKING_STATUSES: ("pending" | "confirmed" | "checked_in")[] = ["pending", "confirmed", "checked_in"];

export interface DiscoveryHotel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hotel_type: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  address: string | null;
  cover_url: string | null;
  logo_url: string | null;
  amenities: string[];
  currency: string;
  is_featured: boolean;
  show_prices: boolean;
  accept_online_bookings: boolean;
  from_price: number | null;
  room_type_count: number;
}

const HOTEL_COLUMNS =
  "id, name, slug, description, hotel_type, city, region, country, address, cover_url, logo_url, amenities, currency, is_featured, show_prices, accept_online_bookings";

function nightsBetween(checkIn: string, checkOut: string) {
  const a = new Date(`${checkIn}T00:00:00Z`).getTime();
  const b = new Date(`${checkOut}T00:00:00Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

export const listPublicHotels = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        search: z.string().max(120).optional().default(""),
        city: z.string().max(80).optional().default(""),
        hotelType: z.string().max(40).optional().default(""),
        maxPrice: z.number().positive().max(1_000_000).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("hotels")
      .select(HOTEL_COLUMNS)
      .eq("status", "active")
      .eq("is_public_listed", true)
      .order("is_featured", { ascending: false })
      .order("name", { ascending: true })
      .limit(60);

    if (data.search) query = query.or(`name.ilike.%${data.search}%,city.ilike.%${data.search}%,description.ilike.%${data.search}%`);
    if (data.city) query = query.eq("city", data.city);
    if (data.hotelType) query = query.eq("hotel_type", data.hotelType);

    const { data: hotels, error } = await query;
    if (error) throw new Error(error.message);

    const ids = (hotels ?? []).map((h) => h.id);
    const priceMap: Record<string, { from: number; count: number }> = {};
    if (ids.length > 0) {
      const { data: types } = await supabaseAdmin
        .from("room_types")
        .select("hotel_id, base_price")
        .in("hotel_id", ids)
        .eq("is_active", true);
      (types ?? []).forEach((t) => {
        const price = Number(t.base_price);
        const entry = priceMap[t.hotel_id];
        if (!entry) priceMap[t.hotel_id] = { from: price, count: 1 };
        else {
          entry.count += 1;
          if (price < entry.from) entry.from = price;
        }
      });
    }

    const rows: DiscoveryHotel[] = (hotels ?? []).map((h) => ({
      ...(h as unknown as Omit<DiscoveryHotel, "from_price" | "room_type_count">),
      from_price: priceMap[h.id]?.from ?? null,
      room_type_count: priceMap[h.id]?.count ?? 0,
    }));

    const filtered = data.maxPrice ? rows.filter((r) => r.from_price !== null && r.from_price <= data.maxPrice!) : rows;

    const cities = Array.from(new Set(rows.map((r) => r.city).filter((c): c is string => Boolean(c)))).sort();
    const types = Array.from(new Set(rows.map((r) => r.hotel_type).filter((t): t is string => Boolean(t)))).sort();

    return { hotels: filtered, cities, types };
  });

export const getPublicHotel = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .select(
        `${HOTEL_COLUMNS}, phone, email, website, check_in_time, check_out_time, tax_percent, service_charge_percent, cancellation_policy, show_availability`,
      )
      .eq("slug", data.slug)
      .eq("status", "active")
      .eq("is_public_listed", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!hotel) return null;

    const [{ data: types }, { data: rooms }, { data: services }] = await Promise.all([
      supabaseAdmin
        .from("room_types")
        .select("id, name, description, base_price, max_guests, bed_type, bed_count, amenities, images")
        .eq("hotel_id", hotel.id)
        .eq("is_active", true)
        .order("base_price", { ascending: true }),
      supabaseAdmin.from("rooms").select("id, room_type_id, status").eq("hotel_id", hotel.id),
      supabaseAdmin.from("services").select("id, name, price, category").eq("hotel_id", hotel.id).eq("is_active", true).limit(12),
    ]);

    const inventory: Record<string, number> = {};
    (rooms ?? []).forEach((r) => {
      if (r.status === "out_of_service" || r.status === "maintenance") return;
      if (!r.room_type_id) return;
      inventory[r.room_type_id] = (inventory[r.room_type_id] ?? 0) + 1;
    });

    const booked: Record<string, number> = {};
    if (data.checkIn && data.checkOut) {
      const { data: overlapping } = await supabaseAdmin
        .from("bookings")
        .select("room_type_id, check_in, check_out, status")
        .eq("hotel_id", hotel.id)
        .in("status", ACTIVE_BOOKING_STATUSES)
        .lt("check_in", data.checkOut)
        .gt("check_out", data.checkIn);
      (overlapping ?? []).forEach((b) => {
        if (!b.room_type_id) return;
        booked[b.room_type_id] = (booked[b.room_type_id] ?? 0) + 1;
      });
    }

    const nights = data.checkIn && data.checkOut ? nightsBetween(data.checkIn, data.checkOut) : 1;
    const taxPercent = Number(hotel.tax_percent ?? 0);
    const servicePercent = Number(hotel.service_charge_percent ?? 0);

    const roomTypes = (types ?? []).map((t) => {
      const total = inventory[t.id] ?? 0;
      const available = Math.max(0, total - (booked[t.id] ?? 0));
      const subtotal = round2(Number(t.base_price) * nights);
      const tax = round2((subtotal * taxPercent) / 100);
      const serviceCharge = round2((subtotal * servicePercent) / 100);
      return {
        ...t,
        base_price: Number(t.base_price),
        rooms_total: total,
        rooms_available: available,
        quote: { nights, subtotal, tax, serviceCharge, total: round2(subtotal + tax + serviceCharge) },
      };
    });

    return { hotel, roomTypes, services: services ?? [], nights };
  });

const bookingSchema = z.object({
  slug: z.string().min(1).max(120),
  roomTypeId: z.string().uuid(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestsCount: z.number().int().min(1).max(20),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  phone: z.string().min(6).max(40),
  notes: z.string().max(500).optional().default(""),
});

export const createPublicBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.checkOut <= data.checkIn) throw new Error("Check-out must be after check-in");

    const { data: hotel } = await supabaseAdmin
      .from("hotels")
      .select("id, name, currency, tax_percent, service_charge_percent, accept_online_bookings, status, is_public_listed")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!hotel || hotel.status !== "active" || !hotel.is_public_listed) throw new Error("Hotel is not available for booking");
    if (!hotel.accept_online_bookings) throw new Error("This hotel is not accepting online bookings right now");

    const { data: roomType } = await supabaseAdmin
      .from("room_types")
      .select("id, hotel_id, name, base_price, max_guests, is_active")
      .eq("id", data.roomTypeId)
      .maybeSingle();
    if (!roomType || roomType.hotel_id !== hotel.id || !roomType.is_active) throw new Error("Room type unavailable");
    if (data.guestsCount > roomType.max_guests) throw new Error(`This room takes up to ${roomType.max_guests} guests`);

    // Availability check (server-side, authoritative)
    const [{ data: rooms }, { data: overlapping }] = await Promise.all([
      supabaseAdmin.from("rooms").select("id, status").eq("room_type_id", roomType.id),
      supabaseAdmin
        .from("bookings")
        .select("id")
        .eq("hotel_id", hotel.id)
        .eq("room_type_id", roomType.id)
        .in("status", ACTIVE_BOOKING_STATUSES)
        .lt("check_in", data.checkOut)
        .gt("check_out", data.checkIn),
    ]);
    const usable = (rooms ?? []).filter((r) => r.status !== "out_of_service" && r.status !== "maintenance").length;
    if (usable - (overlapping?.length ?? 0) <= 0) throw new Error("No rooms of this type are free for those dates");

    const nights = nightsBetween(data.checkIn, data.checkOut);
    const rate = Number(roomType.base_price);
    const subtotal = round2(rate * nights);
    const tax = round2((subtotal * Number(hotel.tax_percent ?? 0)) / 100);
    const serviceCharge = round2((subtotal * Number(hotel.service_charge_percent ?? 0)) / 100);
    const total = round2(subtotal + tax + serviceCharge);

    const { data: existingGuest } = await supabaseAdmin
      .from("guests")
      .select("id")
      .eq("hotel_id", hotel.id)
      .eq("email", data.email)
      .maybeSingle();

    let guestId = existingGuest?.id ?? null;
    if (!guestId) {
      const { data: guest, error: guestError } = await supabaseAdmin
        .from("guests")
        .insert({ hotel_id: hotel.id, full_name: data.fullName, email: data.email, phone: data.phone })
        .select("id")
        .single();
      if (guestError || !guest) throw new Error(guestError?.message ?? "Could not save guest details");
      guestId = guest.id;
    } else {
      await supabaseAdmin.from("guests").update({ full_name: data.fullName, phone: data.phone }).eq("id", guestId);
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        hotel_id: hotel.id,
        guest_id: guestId,
        room_type_id: roomType.id,
        check_in: data.checkIn,
        check_out: data.checkOut,
        guests_count: data.guestsCount,
        room_rate: rate,
        tax_amount: tax,
        service_charge: serviceCharge,
        total,
        status: "pending",
        source: "discovery",
        notes: data.notes ?? "",
      })
      .select("id, reference, total")
      .single();
    if (bookingError || !booking) throw new Error(bookingError?.message ?? "Could not create booking");

    await supabaseAdmin.from("folio_items").insert({
      hotel_id: hotel.id,
      booking_id: booking.id,
      category: "accommodation",
      description: `${roomType.name} · ${nights} night${nights === 1 ? "" : "s"}`,
      quantity: nights,
      unit_price: rate,
      amount: subtotal,
    });

    await supabaseAdmin.from("notifications").insert({
      hotel_id: hotel.id,
      title: "New online booking",
      body: `${data.fullName} booked ${roomType.name} (${booking.reference}) for ${nights} night${nights === 1 ? "" : "s"}.`,
      type: "booking",
    });

    return {
      bookingId: booking.id,
      reference: booking.reference,
      total: Number(booking.total),
      currency: hotel.currency,
      hotelName: hotel.name,
      breakdown: { nights, rate, subtotal, tax, serviceCharge },
    };
  });

export const startPublicPayment = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ reference: z.string().min(3).max(40), origin: z.string().url().max(300) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const secret = process.env["PAYSTACK_SECRET_KEY"];

    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, hotel_id, reference, total, amount_paid, status, guests(full_name, email, phone), hotels(name, currency)")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!booking) throw new Error("Booking not found");
    if (booking.status === "cancelled") throw new Error("This booking was cancelled");

    const outstanding = round2(Number(booking.total) - Number(booking.amount_paid));
    if (outstanding <= 0) return { authorizationUrl: null, outstanding: 0, reason: "paid" as const };
    if (!secret) return { authorizationUrl: null, outstanding, reason: "unconfigured" as const };

    const guest = booking.guests as unknown as { full_name: string; email: string | null; phone: string | null } | null;
    const hotel = booking.hotels as unknown as { name: string; currency: string } | null;

    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        hotel_id: booking.hotel_id,
        booking_id: booking.id,
        amount: outstanding,
        currency: hotel?.currency ?? "GHS",
        method: "mobile_money",
        provider: "paystack",
        status: "processing",
      })
      .select("id")
      .single();
    if (error || !payment) throw new Error(error?.message ?? "Could not start payment");

    const providerRef = `WEB-${payment.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
    await supabaseAdmin.from("payments").update({ provider_reference: providerRef }).eq("id", payment.id);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: guest?.email ?? "guest@custardhotels.com",
        amount: Math.round(outstanding * 100),
        currency: hotel?.currency ?? "GHS",
        reference: providerRef,
        callback_url: `${data.origin}/booking/${booking.reference}`,
        metadata: {
          payment_id: payment.id,
          booking_id: booking.id,
          hotel_id: booking.hotel_id,
          guest_name: guest?.full_name,
          guest_phone: guest?.phone,
        },
      }),
    });

    if (!response.ok) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      throw new Error("Payment could not be started. Please try again.");
    }

    const result = (await response.json()) as { status: boolean; data?: { authorization_url?: string } };
    if (!result.status || !result.data?.authorization_url) {
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", payment.id);
      throw new Error("Payment could not be started. Please try again.");
    }

    return { authorizationUrl: result.data.authorization_url, outstanding, reason: "ok" as const };
  });

export const getPublicBooking = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ reference: z.string().min(3).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, reference, check_in, check_out, nights, guests_count, room_rate, tax_amount, service_charge, total, amount_paid, status, guests(full_name, email), room_types(name), hotels(name, slug, city, currency, phone, email, check_in_time, check_out_time, cancellation_policy)",
      )
      .eq("reference", data.reference)
      .maybeSingle();
    if (!booking) return null;

    // Reconcile paid amount from successful payments so the page is accurate
    // even before the Paystack webhook lands.
    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("amount, status, method, paid_at, receipt_number")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false });

    return { booking, payments: payments ?? [] };
  });
