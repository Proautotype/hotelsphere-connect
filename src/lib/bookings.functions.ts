import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const round2 = (value: number) => Math.round(value * 100) / 100;

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

async function assertHotelAccess(supabase: unknown, hotelId: string) {
  const { data } = await (supabase as RpcClient).rpc("has_hotel_access", { _hotel_id: hotelId });
  if (data !== true) throw new Error("You do not have access to this hotel");
}

function generateRef(prefix: string) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().max(max).optional());

const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().email().optional(),
);

const createBookingSchema = z.object({
  hotelId: z.string().uuid(),
  guest: z.object({
    id: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().uuid().optional()),
    full_name: z.string().min(2),
    email: optionalEmail,
    phone: optionalText(30),
    country: z.string().max(60).default("Ghana"),
    id_type: optionalText(40),
    id_number: optionalText(60),
    address: optionalText(200),
    city: optionalText(100),
    emergency_contact: optionalText(100),
    notes: optionalText(1000),
  }),
  roomTypeId: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().uuid().optional()),
  roomId: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().uuid().optional()),
  checkIn: z.string().date(),
  checkOut: z.string().date(),
  guestsCount: z.number().int().min(1).default(1),
  source: z.enum(["staff", "hotel_website", "discovery", "external"]).default("staff"),
  notes: optionalText(2000),
});


export const createBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createBookingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertHotelAccess(supabase, data.hotelId);

    const { data: hotel } = await supabase.from("hotels").select("currency, tax_percent, service_charge_percent").eq("id", data.hotelId).single();
    if (!hotel) throw new Error("Hotel not found");

    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);
    if (checkOut.getTime() <= checkIn.getTime()) throw new Error("Check-out must be after check-in");
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

    let roomRate = 0;
    let roomTypeId: string | null = data.roomTypeId ?? null;
    let roomId: string | null = data.roomId ?? null;

    if (data.roomId) {
      const { data: room } = await supabase.from("rooms").select("id, room_type_id, status").eq("id", data.roomId).single();
      if (!room) throw new Error("Selected room not found");
      roomTypeId = room.room_type_id ?? roomTypeId;
      roomId = room.id;
    }

    if (!roomId && !roomTypeId) throw new Error("Select a room or room type");

    if (roomTypeId) {
      const { data: rt } = await supabase.from("room_types").select("base_price").eq("id", roomTypeId).single();
      roomRate = Number(rt?.base_price ?? 0);
    }
    if (!roomRate) throw new Error("Could not determine room rate — set a base price on the room type");

    const subtotal = round2(roomRate * nights);
    const tax = round2(subtotal * (Number(hotel.tax_percent) / 100));
    const serviceCharge = round2(subtotal * (Number(hotel.service_charge_percent) / 100));
    const total = round2(subtotal + tax + serviceCharge);

    let guestId = data.guest.id ?? null;
    if (guestId) {
      const { data: existing } = await supabase.from("guests").select("id").eq("id", guestId).eq("hotel_id", data.hotelId).maybeSingle();
      if (!existing) guestId = null;
    }
    if (!guestId) {
      const { data: guest, error: guestError } = await supabase
        .from("guests")
        .insert({
          hotel_id: data.hotelId,
          full_name: data.guest.full_name,
          email: data.guest.email ?? null,
          phone: data.guest.phone ?? null,
          country: data.guest.country,
          id_type: data.guest.id_type ?? null,
          id_number: data.guest.id_number ?? null,
          address: data.guest.address ?? null,
          city: data.guest.city ?? null,
          emergency_contact: data.guest.emergency_contact ?? null,
          notes: data.guest.notes ?? "",
        })
        .select("id")
        .single();
      if (guestError || !guest) throw new Error(guestError?.message ?? "Guest creation failed");
      guestId = guest.id;
    }


    const reference = generateRef("RES");
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        hotel_id: data.hotelId,
        guest_id: guestId,
        room_type_id: roomTypeId,
        room_id: roomId,
        check_in: data.checkIn,
        check_out: data.checkOut,
        guests_count: data.guestsCount,
        room_rate: roomRate,
        tax_amount: tax,
        service_charge: serviceCharge,
        services_total: 0,
        total,
        amount_paid: 0,
        status: "confirmed",
        source: data.source,
        notes: data.notes ?? "",
        reference,
        created_by: userId,
      })
      .select("*")
      .single();
    if (bookingError || !booking) throw new Error(bookingError?.message ?? "Booking creation failed");

    await supabase.from("folio_items").insert({
      hotel_id: data.hotelId,
      booking_id: booking.id,
      category: "accommodation",
      description: `Accommodation: ${nights} night${nights === 1 ? "" : "s"}`,
      quantity: nights,
      unit_price: roomRate,
      amount: subtotal,
      created_by: userId,
    });

    if (roomId) {
      await supabase.from("rooms").update({ status: "reserved" }).eq("id", roomId);
    }

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "booking.created",
      resource: "booking",
      resource_id: booking.id,
      new_value: { reference, total, room_id: roomId },
    });

    return { bookingId: booking.id, reference, total };
  });

const changeBookingSchema = z.object({
  bookingId: z.string().uuid(),
  checkIn: z.string().date().optional(),
  checkOut: z.string().date().optional(),
  roomId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const changeBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => changeBookingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase.from("bookings").select("*").eq("id", data.bookingId).single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (["checked_out", "cancelled"].includes(booking.status)) throw new Error("Booking is closed");

    const update: Record<string, unknown> = {};
    if (data.checkIn) update["check_in"] = data.checkIn;
    if (data.checkOut) update["check_out"] = data.checkOut;
    if (data.roomId) update["room_id"] = data.roomId;
    if (data.roomTypeId) update["room_type_id"] = data.roomTypeId;
    if (data.notes !== undefined) update["notes"] = data.notes;

    const { error } = await supabase.from("bookings").update(update as never).eq("id", data.bookingId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "booking.changed",
      resource: "booking",
      resource_id: booking.id,
      new_value: update as Record<string, never>,
    });

    return { ok: true };
  });

const confirmBookingSchema = z.object({ bookingId: z.string().uuid() });
export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => confirmBookingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, status")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (booking.status !== "pending") throw new Error("Only pending bookings can be confirmed");

    await supabase.from("bookings").update({ status: "confirmed" }).eq("id", data.bookingId);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "booking.confirmed",
      resource: "booking",
      resource_id: booking.id,
    });

    return { ok: true };
  });

const cancelBookingSchema = z.object({ bookingId: z.string().uuid(), reason: z.string().max(500).default("") });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cancelBookingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase.from("bookings").select("id, hotel_id, status, room_id").eq("id", data.bookingId).single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (["checked_in", "checked_out", "cancelled"].includes(booking.status)) throw new Error("Booking cannot be cancelled");

    await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", data.bookingId);

    if (booking.room_id) {
      await supabase.from("rooms").update({ status: "dirty" }).eq("id", booking.room_id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "booking.cancelled",
      resource: "booking",
      resource_id: booking.id,
      new_value: { reason: data.reason },
    });

    return { ok: true };
  });

const checkInOutSchema = z.object({ bookingId: z.string().uuid() });

export const checkInBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkInOutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase.from("bookings").select("id, hotel_id, status, room_id").eq("id", data.bookingId).single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (booking.status !== "confirmed") throw new Error("Only confirmed bookings can be checked in");

    await supabase
      .from("bookings")
      .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
      .eq("id", data.bookingId);

    if (booking.room_id) {
      await supabase.from("rooms").update({ status: "occupied" }).eq("id", booking.room_id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "booking.check_in",
      resource: "booking",
      resource_id: booking.id,
    });

    return { ok: true };
  });

export const checkOutBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkInOutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase.from("bookings").select("id, hotel_id, status, room_id, total, amount_paid").eq("id", data.bookingId).single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (booking.status !== "checked_in") throw new Error("Only checked-in bookings can be checked out");

    const outstanding = round2(Number(booking.total) - Number(booking.amount_paid));
    if (outstanding > 0.009) throw new Error(`Outstanding balance must be paid before check-out: ${outstanding.toFixed(2)}`);

    await supabase
      .from("bookings")
      .update({ status: "checked_out", checked_out_at: new Date().toISOString() })
      .eq("id", data.bookingId);

    if (booking.room_id) {
      await supabase.from("rooms").update({ status: "dirty" }).eq("id", booking.room_id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "booking.check_out",
      resource: "booking",
      resource_id: booking.id,
    });

    return { ok: true };
  });

const addFolioChargeSchema = z.object({
  bookingId: z.string().uuid(),
  description: z.string().min(2).max(200),
  category: z.string().min(1).max(40),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().nonnegative().default(0),
});

export const addFolioCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addFolioChargeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase.from("bookings").select("id, hotel_id, status, total, services_total").eq("id", data.bookingId).single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (["checked_out", "cancelled"].includes(booking.status)) throw new Error("Booking is closed");

    const amount = round2(data.quantity * data.unitPrice);

    await supabase.from("folio_items").insert({
      hotel_id: booking.hotel_id,
      booking_id: booking.id,
      category: data.category,
      description: data.description,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      amount,
      created_by: userId,
    });

    const newServicesTotal = round2(Number(booking.services_total) + amount);
    const newTotal = round2(Number(booking.total) + amount);

    await supabase.from("bookings").update({ services_total: newServicesTotal, total: newTotal }).eq("id", data.bookingId);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "folio.charge_added",
      resource: "booking",
      resource_id: booking.id,
      new_value: { amount, category: data.category },
    });

    return { ok: true, amount, newTotal };
  });
