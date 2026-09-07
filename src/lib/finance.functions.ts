import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PermissionKey } from "@/lib/permissions";

const round2 = (value: number) => Math.round(value * 100) / 100;

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
};

/**
 * A hotel person may act on their hotel when they own it, are its hotel admin,
 * or hold the specific permission. Platform staff are not hotel staff.
 */
async function assertHotelPermission(
  supabase: unknown,
  hotelId: string,
  userId: string,
  permission: PermissionKey,
) {
  const { data: owns } = await (supabase as RpcClient).rpc("owns_hotel", { _hotel_id: hotelId });
  if (owns === true) return;

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: unknown,
        ) => {
          eq: (
            c: string,
            v: unknown,
          ) => {
            eq: (
              c: string,
              v: unknown,
            ) => {
              maybeSingle: () => Promise<{
                data: { staff_role: string; permissions: string[] } | null;
              }>;
            };
          };
        };
      };
    };
  };
  const { data: member } = await db
    .from("hotel_members")
    .select("staff_role, permissions")
    .eq("hotel_id", hotelId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const ok =
    member &&
    (member.staff_role === "hotel_admin" || (member.permissions ?? []).includes(permission));
  if (!ok) throw new Error("You do not have permission to do this for this hotel");
}

const ACTIVE_STATUSES: ("pending" | "confirmed" | "checked_in")[] = [
  "pending",
  "confirmed",
  "checked_in",
];

/* ------------------------------------------------------------------ */
/* Finance overview — payments ledger, stats, purchases, cash session  */
/* ------------------------------------------------------------------ */

const financeQuerySchema = z.object({
  hotelId: z.string().uuid(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export const getFinanceData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => financeQuerySchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertHotelPermission(supabase, data.hotelId, context.userId, "finance:view");

    const fromIso = data.from ? `${data.from}T00:00:00` : "1970-01-01T00:00:00";
    const toIso = data.to ? `${data.to}T23:59:59` : "2999-12-31T23:59:59";

    const [hotelRes, paymentsRes, openSessionRes, outstandingRes, purchasesRes, bookingsRes] =
      await Promise.all([
        supabase
          .from("hotels")
          .select("name, address, city, phone, email, currency")
          .eq("id", data.hotelId)
          .single(),
        supabase
          .from("payments")
          .select(
            "id, reference, receipt_number, amount, method, provider, status, paid_at, created_at, booking_id, bookings(reference), guests(full_name)",
          )
          .eq("hotel_id", data.hotelId)
          .gte("paid_at", fromIso)
          .lte("paid_at", toIso)
          .order("paid_at", { ascending: false })
          .limit(200),
        supabase
          .from("cash_sessions")
          .select("*")
          .eq("hotel_id", data.hotelId)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1),
        supabase
          .from("bookings")
          .select("total, amount_paid")
          .in("status", ACTIVE_STATUSES)
          .eq("hotel_id", data.hotelId),
        supabase
          .from("folio_items")
          .select(
            "id, description, category, quantity, unit_price, amount, created_at, bookings(reference, guests(full_name))",
          )
          .eq("hotel_id", data.hotelId)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("bookings")
          .select("id, reference, status, total, amount_paid, guests(full_name)")
          .eq("hotel_id", data.hotelId)
          .in("status", ACTIVE_STATUSES)
          .order("check_in", { ascending: false })
          .limit(50),
      ]);

    if (hotelRes.error || !hotelRes.data)
      throw new Error(hotelRes.error?.message ?? "Hotel not found");

    const payments = (paymentsRes.data ?? []).map((p) => ({
      id: p.id,
      reference: p.reference,
      receipt_number: p.receipt_number,
      amount: Number(p.amount),
      method: p.method,
      provider: p.provider,
      status: p.status,
      paid_at: p.paid_at,
      created_at: p.created_at,
      booking_reference: (p.bookings as unknown as { reference: string } | null)?.reference ?? null,
      guest_name: (p.guests as unknown as { full_name: string } | null)?.full_name ?? null,
    }));

    const todayKey = data.to ?? data.from ?? new Date().toISOString().slice(0, 10);
    const todayRes = await supabase
      .from("payments")
      .select("id, amount")
      .eq("hotel_id", data.hotelId)
      .eq("status", "successful")
      .gte("paid_at", `${todayKey}T00:00:00`)
      .lte("paid_at", `${todayKey}T23:59:59`);

    const received = payments
      .filter((p) => p.status === "successful")
      .reduce((sum, p) => sum + p.amount, 0);
    const todayReceived = (todayRes.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    const outstanding = (outstandingRes.data ?? []).reduce(
      (sum, b) => sum + Math.max(0, Number(b.total) - Number(b.amount_paid)),
      0,
    );

    const purchases = (purchasesRes.data ?? []).map((c) => ({
      id: c.id,
      description: c.description,
      category: c.category,
      quantity: Number(c.quantity),
      unit_price: Number(c.unit_price),
      amount: Number(c.amount),
      created_at: c.created_at,
      booking_reference: (c.bookings as unknown as { reference: string } | null)?.reference ?? null,
      guest_name:
        (c.bookings as unknown as { guests: { full_name: string } | null } | null)?.guests
          ?.full_name ?? null,
    }));
    const purchasesTotal = purchases.reduce((sum, c) => sum + c.amount, 0);

    const bookings = (bookingsRes.data ?? []).map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      balance: round2(Number(b.total) - Number(b.amount_paid)),
      guest_name: (b.guests as unknown as { full_name: string } | null)?.full_name ?? null,
    }));

    const expensesRes = await supabase
      .from("expenses")
      .select(
        "id, spent_on, category, vendor, description, amount, method, reference, note, created_at",
      )
      .eq("hotel_id", data.hotelId)
      .gte("spent_on", data.from ?? "1970-01-01")
      .lte("spent_on", data.to ?? "2999-12-31")
      .order("spent_on", { ascending: false })
      .limit(200);

    const expenses = (expensesRes.data ?? []).map((e) => ({
      id: e.id,
      spent_on: e.spent_on,
      category: e.category as string,
      vendor: e.vendor,
      description: e.description,
      amount: Number(e.amount),
      method: e.method as string,
      reference: e.reference,
      note: e.note,
      created_at: e.created_at,
    }));
    const expensesTotal = round2(expenses.reduce((sum, e) => sum + e.amount, 0));

    const byCategory = Object.entries(
      expenses.reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = round2((acc[e.category] ?? 0) + e.amount);
        return acc;
      }, {}),
    )
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      hotel: hotelRes.data,
      currency: hotelRes.data.currency ?? "GHS",
      payments,
      totals: {
        received,
        today: todayReceived,
        outstanding,
        count: payments.length,
        expenses: expensesTotal,
        net: round2(received - expensesTotal),
      },
      openSession: openSessionRes.data?.[0] ?? null,
      purchases,
      purchasesTotal,
      bookings,
      expenses,
      expensesTotal,
      expensesByCategory: byCategory,
    };
  });

/* ------------------------------------------------------------------ */
/* Hotel expenses — money the business spends running the hotel        */
/* ------------------------------------------------------------------ */

const EXPENSE_CATEGORIES = [
  "utilities",
  "supplies",
  "salaries",
  "maintenance",
  "food_drink",
  "transport",
  "marketing",
  "rent",
  "taxes_fees",
  "other",
] as const;

const EXPENSE_METHODS = ["cash", "mobile_money", "bank_transfer", "card"] as const;

const addExpenseSchema = z.object({
  hotelId: z.string().uuid(),
  spentOn: z.string().date(),
  category: z.enum(EXPENSE_CATEGORIES),
  vendor: z.string().max(120).default(""),
  description: z.string().min(2).max(200),
  amount: z.number().positive().max(10_000_000),
  method: z.enum(EXPENSE_METHODS).default("cash"),
  reference: z.string().max(80).default(""),
  note: z.string().max(400).default(""),
});

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addExpenseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelPermission(supabase, data.hotelId, userId, "payments:record");

    // Cash spending is tied to the drawer that is open, so the count adds up.
    let cashSessionId: string | null = null;
    if (data.method === "cash") {
      const { data: session } = await supabase
        .from("cash_sessions")
        .select("id")
        .eq("hotel_id", data.hotelId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      cashSessionId = session?.id ?? null;
    }

    const { data: inserted, error } = await supabase
      .from("expenses")
      .insert({
        hotel_id: data.hotelId,
        spent_on: data.spentOn,
        category: data.category,
        vendor: data.vendor,
        description: data.description,
        amount: round2(data.amount),
        method: data.method,
        reference: data.reference,
        note: data.note,
        cash_session_id: cashSessionId,
        created_by: userId,
      })
      .select("id, amount")
      .single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "finance.expense_recorded",
      resource: "expense",
      resource_id: inserted.id,
      new_value: {
        amount: round2(data.amount),
        category: data.category,
        description: data.description,
        method: data.method,
      },
    });

    return { ok: true, id: inserted.id, amount: round2(data.amount) };
  });

const deleteExpenseSchema = z.object({
  hotelId: z.string().uuid(),
  expenseId: z.string().uuid(),
});

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => deleteExpenseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelPermission(supabase, data.hotelId, userId, "payments:record");

    const { data: existing } = await supabase
      .from("expenses")
      .select("id, amount, description")
      .eq("id", data.expenseId)
      .eq("hotel_id", data.hotelId)
      .maybeSingle();
    if (!existing) throw new Error("That expense belongs to another hotel");

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", data.expenseId)
      .eq("hotel_id", data.hotelId);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "finance.expense_deleted",
      resource: "expense",
      resource_id: existing.id,
      old_value: { amount: Number(existing.amount), description: existing.description },
    });

    return { ok: true };
  });

export const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES;


/* ------------------------------------------------------------------ */
/* Record a purchase — post guest charges to a booking folio           */
/* ------------------------------------------------------------------ */

const purchaseItemSchema = z.object({
  category: z.string().min(1).max(40),
  description: z.string().min(2).max(200),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().nonnegative().default(0),
});

const recordPurchaseSchema = z.object({
  hotelId: z.string().uuid(),
  bookingId: z.string().uuid(),
  items: z.array(purchaseItemSchema).min(1).max(50),
});

export const recordPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => recordPurchaseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertHotelPermission(supabase, data.hotelId, context.userId, "payments:record");

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, hotel_id, status, total, services_total")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    if (booking.hotel_id !== data.hotelId) throw new Error("Booking does not belong to this hotel");
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
      action: "finance.purchase_recorded",
      resource: "booking",
      resource_id: booking.id,
      new_value: {
        amount: totalAmount,
        count: rows.length,
        items: rows.map((r) => ({ description: r.description, amount: r.amount })),
      },
    });

    return { ok: true, amount: totalAmount };
  });
