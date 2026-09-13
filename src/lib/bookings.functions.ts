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
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().max(max).optional(),
  );

const optionalEmail = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().email().optional(),
);

const createBookingSchema = z.object({
  hotelId: z.string().uuid(),
  guest: z.object({
    id: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().uuid().optional(),
    ),
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
  roomTypeId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid().optional(),
  ),
  roomId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid().optional(),
  ),
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

    const { data: hotel } = await supabase
      .from("hotels")
      .select("currency, tax_percent, service_charge_percent")
      .eq("id", data.hotelId)
      .single();
    if (!hotel) throw new Error("Hotel not found");

    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);
    if (checkOut.getTime() <= checkIn.getTime())
      throw new Error("Check-out must be after check-in");
    const nights = Math.max(
      1,
      Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)),
    );

    let roomRate = 0;
    let roomTypeId: string | null = data.roomTypeId ?? null;
    let roomId: string | null = data.roomId ?? null;

    if (data.roomId) {
      const { data: room } = await supabase
        .from("rooms")
        .select("id, room_type_id, status")
        .eq("id", data.roomId)
        .single();
      if (!room) throw new Error("Selected room not found");
      roomTypeId = room.room_type_id ?? roomTypeId;
      roomId = room.id;
    }

    if (!roomId && !roomTypeId) throw new Error("Select a room or room type");

    if (roomTypeId) {
      const { data: rt } = await supabase
        .from("room_types")
        .select("base_price")
        .eq("id", roomTypeId)
        .single();
      roomRate = Number(rt?.base_price ?? 0);
    }
    if (!roomRate)
      throw new Error("Could not determine room rate — set a base price on the room type");

    const subtotal = round2(roomRate * nights);
    const tax = round2(subtotal * (Number(hotel.tax_percent) / 100));
    const serviceCharge = round2(subtotal * (Number(hotel.service_charge_percent) / 100));
    const total = round2(subtotal + tax + serviceCharge);

    let guestId = data.guest.id ?? null;
    if (guestId) {
      const { data: existing } = await supabase
        .from("guests")
        .select("id")
        .eq("id", guestId)
        .eq("hotel_id", data.hotelId)
        .maybeSingle();
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
    if (bookingError || !booking)
      throw new Error(bookingError?.message ?? "Booking creation failed");

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

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (["checked_out", "cancelled"].includes(booking.status)) throw new Error("Booking is closed");

    const update: Record<string, unknown> = {};
    if (data.checkIn) update["check_in"] = data.checkIn;
    if (data.checkOut) update["check_out"] = data.checkOut;
    if (data.roomId) update["room_id"] = data.roomId;
    if (data.roomTypeId) update["room_type_id"] = data.roomTypeId;
    if (data.notes !== undefined) update["notes"] = data.notes;

    const { error } = await supabase
      .from("bookings")
      .update(update as never)
      .eq("id", data.bookingId);
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

type MinimalDb = {
  from: (table: string) => any;
};

/**
 * Move a booking from one status to the next, but only if it is still in the
 * status we expect. This makes the change atomic, so two clicks (or two staff
 * members) can never check the same guest in or out twice.
 */
async function transitionStatus(
  supabase: unknown,
  bookingId: string,
  from: string,
  to: string,
  extra: Record<string, unknown> = {},
) {
  const { data, error } = await (supabase as MinimalDb)
    .from("bookings")
    .update({ status: to, ...extra })
    .eq("id", bookingId)
    .eq("status", from)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error(
      `This booking is no longer ${from.replace(/_/g, " ")} — someone may have already done this. Refresh to see the latest status.`,
    );
  }
}

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

    await transitionStatus(supabase, data.bookingId, "pending", "confirmed");

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "booking.confirmed",
      resource: "booking",
      resource_id: booking.id,
    });

    return { ok: true };
  });

const cancelBookingSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().max(500).default(""),
});

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cancelBookingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, status, room_id")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (!["pending", "confirmed"].includes(booking.status))
      throw new Error(
        "Only bookings that have not started can be cancelled. Check the guest out instead.",
      );

    await transitionStatus(supabase, data.bookingId, booking.status, "cancelled", {
      cancelled_at: new Date().toISOString(),
    });

    if (booking.room_id) {
      await supabase.from("rooms").update({ status: "available" }).eq("id", booking.room_id);
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

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, status, room_id")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (booking.status === "checked_in") throw new Error("This guest is already checked in");
    if (booking.status !== "confirmed")
      throw new Error("Only confirmed bookings can be checked in");

    await transitionStatus(supabase, data.bookingId, "confirmed", "checked_in", {
      checked_in_at: new Date().toISOString(),
    });

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

/** Days from `from` (inclusive) to `to` (exclusive), never negative. */
function nightsBetween(from: string, to: string) {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

interface CheckOutMath {
  early: boolean;
  unusedNights: number;
  unusedValue: number;
  adjustedTotal: number;
  outstanding: number;
  grossRefund: number;
  withheld: number;
  netRefund: number;
  withholdPercent: number;
  withholdFlat: number;
}

function checkOutMath(
  booking: {
    check_out: string;
    room_rate: number | string;
    total: number | string;
    amount_paid: number | string;
  },
  hotel: {
    early_checkout_withhold_percent: number | string;
    early_checkout_withhold_flat: number | string;
  },
  todayIso: string,
): CheckOutMath {
  const unusedNights = nightsBetween(todayIso, booking.check_out);
  const unusedValue = round2(Number(booking.room_rate) * unusedNights);
  const adjustedTotal = Math.max(0, round2(Number(booking.total) - unusedValue));
  const paid = Number(booking.amount_paid);
  const outstanding = Math.max(0, round2(adjustedTotal - paid));
  const grossRefund = Math.max(0, round2(paid - adjustedTotal));
  const percent = Number(hotel.early_checkout_withhold_percent ?? 0);
  const flat = Number(hotel.early_checkout_withhold_flat ?? 0);
  const withheld =
    grossRefund > 0
      ? Math.min(grossRefund, round2(Math.max((grossRefund * percent) / 100, flat)))
      : 0;
  return {
    early: unusedNights > 0,
    unusedNights,
    unusedValue,
    adjustedTotal,
    outstanding,
    grossRefund,
    withheld,
    netRefund: round2(grossRefund - withheld),
    withholdPercent: percent,
    withholdFlat: flat,
  };
}

/** Read-only preview so staff see the refund maths before they commit. */
export const previewCheckOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkInOutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, status, check_in, check_out, room_rate, total, amount_paid")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);

    const { data: hotel } = await supabase
      .from("hotels")
      .select("currency, early_checkout_withhold_percent, early_checkout_withhold_flat")
      .eq("id", booking.hotel_id)
      .single();
    if (!hotel) throw new Error("Hotel not found");

    const todayIso = new Date().toISOString().slice(0, 10);
    return {
      ...checkOutMath(booking, hotel, todayIso),
      currency: hotel.currency,
      status: booking.status,
    };
  });

const checkOutSchema = z.object({
  bookingId: z.string().uuid(),
  refundMethod: z.enum(["none", "cash", "mobile_money"]).default("none"),
  sessionId: z.string().uuid().optional(),
});

export const checkOutBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkOutSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase
      .from("bookings")
      .select(
        "id, hotel_id, status, room_id, guest_id, reference, check_in, check_out, room_rate, total, amount_paid, services_total",
      )
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (booking.status === "checked_out")
      throw new Error("This guest has already been checked out");
    if (booking.status !== "checked_in")
      throw new Error("Only checked-in bookings can be checked out");

    const { data: hotel } = await supabase
      .from("hotels")
      .select("currency, early_checkout_withhold_percent, early_checkout_withhold_flat")
      .eq("id", booking.hotel_id)
      .single();
    if (!hotel) throw new Error("Hotel not found");

    const todayIso = new Date().toISOString().slice(0, 10);
    const math = checkOutMath(booking, hotel, todayIso);

    if (math.outstanding > 0.009)
      throw new Error(
        `Outstanding balance must be paid before check-out: ${math.outstanding.toFixed(2)}`,
      );
    if (math.netRefund > 0.009 && data.refundMethod === "none")
      throw new Error(
        `This is an early check-out with ${math.netRefund.toFixed(2)} to refund. Choose how to pay the guest back.`,
      );

    // Close the stay first, so a second click cannot repeat the refund.
    await transitionStatus(supabase, data.bookingId, "checked_in", "checked_out", {
      checked_out_at: new Date().toISOString(),
    });

    let refundedAmount = 0;
    let refundNote = "";

    if (math.early) {
      // Drop the nights the guest never used, then charge the fee the hotel keeps.
      let newTotal = math.adjustedTotal;

      if (math.withheld > 0.009) {
        await supabase.from("folio_items").insert({
          hotel_id: booking.hotel_id,
          booking_id: booking.id,
          category: "extra",
          description: "Early departure fee",
          quantity: 1,
          unit_price: math.withheld,
          amount: math.withheld,
          created_by: userId,
        });
        newTotal = round2(newTotal + math.withheld);
      }

      if (math.netRefund > 0.009) {
        const result = await payRefund({
          supabase,
          supabaseAdmin,
          booking,
          amount: math.netRefund,
          method: data.refundMethod === "mobile_money" ? "mobile_money" : "cash",
          sessionId: data.sessionId ?? null,
          userId,
          reason: `Early check-out refund (${math.unusedNights} unused night${math.unusedNights === 1 ? "" : "s"})`,
        });
        refundedAmount = result.amount;
        refundNote = result.note;
      }

      await supabase
        .from("bookings")
        .update({
          total: newTotal,
          amount_paid: round2(Number(booking.amount_paid) - refundedAmount),
          refunded_amount: refundedAmount,
          withheld_amount: math.withheld,
          early_checkout: true,
        })
        .eq("id", booking.id);
    }

    if (booking.room_id) {
      await supabase.from("rooms").update({ status: "dirty" }).eq("id", booking.room_id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "booking.check_out",
      resource: "booking",
      resource_id: booking.id,
      new_value: {
        early: math.early,
        unused_nights: math.unusedNights,
        refunded: refundedAmount,
        withheld: math.withheld,
        method: data.refundMethod,
      },
    });

    return {
      ok: true,
      early: math.early,
      refunded: refundedAmount,
      withheld: math.withheld,
      note: refundNote,
    };
  });

/**
 * Pays money back to a guest. Cash is handed over at the front desk and logged
 * against the drawer; Mobile Money is sent back through Paystack.
 */
async function payRefund(args: {
  supabase: any;
  supabaseAdmin: any;
  booking: { id: string; hotel_id: string; guest_id: string | null; reference: string };
  amount: number;
  method: "cash" | "mobile_money";
  sessionId: string | null;
  userId: string;
  reason: string;
}) {
  const { supabase, supabaseAdmin, booking, amount, method, sessionId, userId, reason } = args;
  let provider = "manual";
  let providerReference: string | null = null;
  let note = "Cash handed to the guest at the front desk.";

  if (method === "mobile_money") {
    const secret = (process.env["PAYSTACK_SECRET_KEY"] as string | undefined) ?? null;
    const { data: source } = await supabase
      .from("payments")
      .select("id, provider_reference, amount")
      .eq("booking_id", booking.id)
      .eq("provider", "paystack")
      .eq("status", "successful")
      .eq("kind", "charge")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!secret || !source?.provider_reference)
      throw new Error(
        "Mobile Money refunds are not available for this booking — refund cash at the front desk instead.",
      );

    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction: source.provider_reference,
        amount: Math.round(amount * 100),
        merchant_note: reason,
      }),
    });
    if (!response.ok)
      throw new Error(
        "Mobile Money refund was declined by the provider — refund cash at the front desk instead.",
      );
    provider = "paystack";
    providerReference = source.provider_reference as string;
    note = "Mobile Money refund sent; it can take a few minutes to arrive.";
  }

  const reference = generateRef("REF");
  const { error } = await supabase.from("payments").insert({
    hotel_id: booking.hotel_id,
    booking_id: booking.id,
    guest_id: booking.guest_id,
    amount: -amount,
    currency: "GHS",
    method,
    provider,
    provider_reference: providerReference,
    status: "refunded",
    kind: "refund",
    reason,
    reference,
    receipt_number: generateRef("RRC"),
    cash_session_id: method === "cash" ? sessionId : null,
    metadata: { refund: true, note: reason },
    received_by: userId,
    paid_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("audit_logs").insert({
    hotel_id: booking.hotel_id,
    user_id: userId,
    action: "payment.refunded",
    resource: "booking",
    resource_id: booking.id,
    new_value: { amount, method, reason },
  });

  return { amount, note };
}

const manualRefundSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  method: z.enum(["cash", "mobile_money"]).default("cash"),
  reason: z.string().min(3).max(300),
  sessionId: z.string().uuid().optional(),
});

/** Refund a guest outside of check-out, e.g. a service they never received. */
export const refundBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => manualRefundSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, guest_id, reference, total, amount_paid, refunded_amount")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);

    const amount = round2(data.amount);
    if (amount > Number(booking.amount_paid) + 0.009)
      throw new Error(
        `You cannot refund more than the guest has paid (${Number(booking.amount_paid).toFixed(2)})`,
      );

    const result = await payRefund({
      supabase,
      supabaseAdmin,
      booking,
      amount,
      method: data.method,
      sessionId: data.sessionId ?? null,
      userId,
      reason: data.reason,
    });

    await supabase
      .from("bookings")
      .update({
        amount_paid: round2(Number(booking.amount_paid) - amount),
        refunded_amount: round2(Number(booking.refunded_amount ?? 0) + amount),
      })
      .eq("id", booking.id);

    return { ok: true, amount: result.amount, note: result.note };
  });


const folioChargeItemSchema = z.object({
  description: z.string().min(2).max(200),
  category: z.string().min(1).max(40),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().nonnegative().default(0),
});

const addFolioChargeSchema = z.object({
  bookingId: z.string().uuid(),
  items: z.array(folioChargeItemSchema).min(1).max(50),
});

export const addFolioCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addFolioChargeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, status, total, services_total")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (["checked_out", "cancelled"].includes(booking.status)) throw new Error("Booking is closed");

    const rows = data.items.map((item) => ({
      hotel_id: booking.hotel_id,
      booking_id: booking.id,
      category: item.category,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      amount: round2(item.quantity * item.unitPrice),
      created_by: userId,
    }));
    const totalAmount = round2(rows.reduce((sum, row) => sum + row.amount, 0));

    const { error: insertError } = await supabase.from("folio_items").insert(rows);
    if (insertError) throw new Error(insertError.message);

    const newServicesTotal = round2(Number(booking.services_total) + totalAmount);
    const newTotal = round2(Number(booking.total) + totalAmount);

    await supabase
      .from("bookings")
      .update({ services_total: newServicesTotal, total: newTotal })
      .eq("id", data.bookingId);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "folio.charge_added",
      resource: "booking",
      resource_id: booking.id,
      new_value: {
        amount: totalAmount,
        count: rows.length,
        items: data.items.map((i) => ({
          description: i.description,
          category: i.category,
          amount: round2(i.quantity * i.unitPrice),
        })),
      },
    });

    return { ok: true, amount: totalAmount, newTotal };
  });
