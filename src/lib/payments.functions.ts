import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac, timingSafeEqual } from "crypto";

const round2 = (value: number) => Math.round(value * 100) / 100;

function createPaymentRef(prefix: string, id: string) {
  const short = id.replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${prefix}-${short}`;
}

async function assertHotelAccess(supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> }, hotelId: string) {
  const { data } = await supabase.rpc("has_hotel_access", { _hotel_id: hotelId });
  if (data !== true) throw new Error("You do not have access to this hotel");
}

async function getPaystackSecret(): Promise<string | null> {
  try {
    return (process.env["PAYSTACK_SECRET_KEY"] as string | undefined) ?? null;
  } catch {
    return null;
  }
}

const cashPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  note: z.string().max(500).default(""),
  sessionId: z.string().uuid().optional(),
});

export const recordCashPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => cashPaymentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, total, amount_paid, guest_id, status, reference, currency")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);
    if (["checked_out", "cancelled"].includes(booking.status)) throw new Error("Booking is closed; payment not allowed");

    const amount = round2(data.amount);
    const outstanding = round2(Number(booking.total) - Number(booking.amount_paid));
    if (amount > outstanding + 0.009) throw new Error(`Payment exceeds outstanding balance (${outstanding.toFixed(2)})`);

    const reference = createPaymentRef("PMT", booking.id);
    const receipt = createPaymentRef("RCP", booking.id);

    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        hotel_id: booking.hotel_id,
        booking_id: booking.id,
        guest_id: booking.guest_id,
        amount,
        currency: booking.currency ?? "GHS",
        method: "cash",
        provider: "manual",
        status: "successful",
        reference,
        receipt_number: receipt,
        cash_session_id: data.sessionId ?? null,
        metadata: { note: data.note },
        received_by: userId,
        paid_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !payment) throw new Error(error?.message ?? "Payment could not be recorded");

    const newPaid = round2(Number(booking.amount_paid) + amount);
    await supabase.from("bookings").update({ amount_paid: newPaid }).eq("id", booking.id);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: booking.hotel_id,
      user_id: userId,
      action: "payment.cash_recorded",
      resource: "payment",
      resource_id: payment.id,
      new_value: { booking_id: booking.id, amount },
    });

    return { paymentId: payment.id, amount, outstanding: round2(outstanding - amount) };
  });

export const initializePaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ bookingId: z.string().uuid(), email: z.string().email(), amount: z.number().positive().max(1_000_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const secret = await getPaystackSecret();
    if (!secret) {
      throw new Error("Paystack is not configured. Ask the platform admin to add the PAYSTACK_SECRET_KEY secret.");
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, total, amount_paid, reference, currency, guests(full_name, phone)")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    await assertHotelAccess(supabase, booking.hotel_id);

    const outstanding = round2(Number(booking.total) - Number(booking.amount_paid));
    if (data.amount > outstanding + 0.009) throw new Error("Amount exceeds outstanding balance");

    const { data: inserted, error } = await supabase
      .from("payments")
      .insert({
        hotel_id: booking.hotel_id,
        booking_id: booking.id,
        amount: data.amount,
        currency: booking.currency ?? "GHS",
        method: "mobile_money",
        provider: "paystack",
        status: "processing",
      })
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "Could not create payment");

    const reference = createPaymentRef("PAY", inserted.id);
    await supabase.from("payments").update({ provider_reference: reference }).eq("id", inserted.id);

    const { data: hotel } = await supabase.from("hotels").select("name").eq("id", booking.hotel_id).single();
    const guest = booking.guests as unknown as { full_name: string; phone?: string } | null;

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        amount: Math.round(data.amount * 100),
        currency: (booking.currency ?? "GHS").toUpperCase(),
        reference,
        callback_url: typeof process !== "undefined" ? `${process.env["APP_URL"] ?? ""}/payments/verify` : "",
        metadata: {
          payment_id: inserted.id,
          booking_id: booking.id,
          hotel_id: booking.hotel_id,
          guest_name: guest?.full_name,
          guest_phone: guest?.phone,
          custom_fields: [
            { display_name: "Hotel", variable_name: "hotel", value: hotel?.name },
            { display_name: "Booking", variable_name: "booking_reference", value: booking.reference },
          ],
        },
      }),
    });

    if (!response.ok) {
      await supabase.from("payments").update({ status: "failed", metadata: { failure: "Paystack initialization failed" } }).eq("id", inserted.id);
      throw new Error("Paystack charge initialization failed");
    }

    const result = (await response.json()) as { status: boolean; data: { authorization_url: string; reference: string } };
    if (!result.status || !result.data?.authorization_url) {
      await supabase.from("payments").update({ status: "failed", metadata: { failure: "Paystack initialization failed" } }).eq("id", inserted.id);
      throw new Error("Paystack charge initialization failed");
    }

    return { paymentId: inserted.id, reference, authorizationUrl: result.data.authorization_url };
  });

export const verifyPaystackPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ reference: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const secret = await getPaystackSecret();
    if (!secret) throw new Error("Paystack not configured");

    const { data: payment } = await supabase
      .from("payments")
      .select("id, hotel_id, booking_id, amount, status, provider_reference")
      .eq("provider_reference", data.reference)
      .single();
    if (!payment) throw new Error("Payment not found");

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!response.ok) throw new Error("Could not reach Paystack");

    const body = (await response.json()) as { status: boolean; data?: { status: string; amount: number } };
    if (!body.status || !body.data) throw new Error("Paystack verification failed");

    const verifiedAmount = round2((body.data.amount ?? 0) / 100);
    const verifiedStatus = body.data.status;

    if (payment.status === "successful") {
      return { status: "successful", paymentId: payment.id, amount: verifiedAmount };
    }

    if (verifiedStatus === "success") {
      if (Math.abs(verifiedAmount - Number(payment.amount)) > 0.01) {
        throw new Error("Payment amount mismatch");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("payments").update({ status: "successful", paid_at: new Date().toISOString() }).eq("id", payment.id);
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, amount_paid")
        .eq("id", payment.booking_id)
        .single();
      if (booking) {
        await supabaseAdmin
          .from("bookings")
          .update({ amount_paid: round2(Number(booking.amount_paid) + verifiedAmount) })
          .eq("id", payment.booking_id);
      }
      await supabaseAdmin.from("audit_logs").insert({
        hotel_id: payment.hotel_id,
        action: "payment.paystack_verified",
        resource: "payment",
        resource_id: payment.id,
        new_value: { amount: verifiedAmount, reference: data.reference },
      });
      return { status: "successful", paymentId: payment.id, amount: verifiedAmount };
    }

    await supabase.from("payments").update({ status: verifiedStatus }).eq("id", payment.id);
    return { status: verifiedStatus, paymentId: payment.id, amount: verifiedAmount };
  });

export const openCashSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ hotelId: z.string().uuid(), openingBalance: z.number().nonnegative().max(1_000_000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelAccess(supabase, data.hotelId);

    const { data: existing } = await supabase
      .from("cash_sessions")
      .select("id")
      .eq("hotel_id", data.hotelId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) throw new Error("A cash session is already open. Close it first.");

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();

    const { data: session, error } = await supabase
      .from("cash_sessions")
      .insert({
        hotel_id: data.hotelId,
        user_id: userId,
        opening_balance: data.openingBalance,
        cashier_name: profile?.full_name ?? "Cashier",
        status: "open",
      })
      .select("id")
      .single();
    if (error || !session) throw new Error(error?.message ?? "Could not open cash session");
    return { sessionId: session.id };
  });

export const closeCashSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ sessionId: z.string().uuid(), actualCash: z.number().nonnegative().max(1_000_000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabase
      .from("cash_sessions")
      .select("id, hotel_id, opening_balance, expected_cash, status")
      .eq("id", data.sessionId)
      .single();
    if (!session) throw new Error("Cash session not found");
    if (session.status !== "open") throw new Error("This session is already closed");

    const expected = round2(Number(session.opening_balance) + Number(session.expected_cash ?? 0));
    const difference = round2(data.actualCash - expected);

    await supabase
      .from("cash_sessions")
      .update({
        status: "closed",
        actual_cash: data.actualCash,
        expected_cash: expected,
        difference,
        closed_at: new Date().toISOString(),
      })
      .eq("id", data.sessionId);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: session.hotel_id,
      user_id: userId,
      action: "cash.session_closed",
      resource: "cash_session",
      resource_id: session.id,
      new_value: { actual_cash: data.actualCash, expected, difference },
    });

    return { sessionId: session.id, expected, difference };
  });

const reconcileSchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(["adjustment", "refund", "withdrawal", "deposit"]),
  amount: z.number().positive().max(1_000_000),
  note: z.string().max(500).default(""),
});

export const reconcileCashSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => reconcileSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: session } = await supabase
      .from("cash_sessions")
      .select("id, hotel_id, status, notes")
      .eq("id", data.sessionId)
      .single();
    if (!session) throw new Error("Cash session not found");
    if (session.status !== "open") throw new Error("Can only reconcile an open cash session");

    const notes = [session.notes || "", `${data.type}: ${data.amount} - ${data.note}`].filter(Boolean).join("; ");
    await supabase.from("cash_sessions").update({ notes }).eq("id", data.sessionId);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: session.hotel_id,
      user_id: userId,
      action: "cash.reconciled",
      resource: "cash_session",
      resource_id: session.id,
      new_value: { type: data.type, amount: data.amount, note: data.note },
    });
    return { ok: true };
  });

export const handlePaystackWebhook = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ signature: z.string(), body: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const secret = await getPaystackSecret();
    if (!secret) throw new Error("Paystack not configured");

    const expected = createHmac("sha512", secret).update(data.body).digest("hex");
    if (!timingSafeEqual(Buffer.from(data.signature), Buffer.from(expected))) {
      return { ok: false, message: "Invalid signature" };
    }

    const event = JSON.parse(data.body) as { event: string; data?: { reference?: string; status?: string; amount?: number } };
    if (event.event !== "charge.success" || !event.data?.reference) {
      return { ok: true, message: "Ignored" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, booking_id, amount, status")
      .eq("provider_reference", event.data.reference)
      .single();
    if (!payment || payment.status === "successful") return { ok: true, message: "Already processed or not found" };

    const amount = round2((event.data.amount ?? 0) / 100);
    if (Math.abs(amount - Number(payment.amount)) > 0.01) {
      return { ok: false, message: "Amount mismatch" };
    }

    await supabaseAdmin.from("payments").update({ status: "successful", paid_at: new Date().toISOString() }).eq("id", payment.id);
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, amount_paid")
      .eq("id", payment.booking_id)
      .single();
    if (booking) {
      await supabaseAdmin
        .from("bookings")
        .update({ amount_paid: round2(Number(booking.amount_paid) + amount) })
        .eq("id", payment.booking_id);
    }
    await supabaseAdmin.from("audit_logs").insert({
      action: "payment.paystack_webhook",
      resource: "payment",
      resource_id: payment.id,
      new_value: { reference: event.data.reference, amount },
    });

    return { ok: true, message: "Processed" };
  });
