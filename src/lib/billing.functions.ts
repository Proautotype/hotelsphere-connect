import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PermissionKey } from "@/lib/permissions";

type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };

/**
 * A hotel person may act on their hotel when they own it, are its hotel admin,
 * or hold the specific permission. Platform staff are not hotel staff.
 */
async function assertHotelPermission(supabase: unknown, hotelId: string, userId: string, permission: PermissionKey) {
  const { data: owns } = await (supabase as RpcClient).rpc("owns_hotel", { _hotel_id: hotelId });
  if (owns === true) return;

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => {
            eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: { staff_role: string; permissions: string[] } | null }> };
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

  const ok = member && (member.staff_role === "hotel_admin" || (member.permissions ?? []).includes(permission));
  if (!ok) throw new Error("You do not have permission to do this for this hotel");
}

/* ------------------------------------------------------------------ */
/* Plan, invoices and advertising — the hotel's own view               */
/* ------------------------------------------------------------------ */

export const getHotelBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ hotelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertHotelPermission(supabase, data.hotelId, context.userId, "billing:view");

    const [sub, invoices, ads, plans, settings, dataReqs] = await Promise.all([
      supabase.from("hotel_subscriptions").select("*").eq("hotel_id", data.hotelId).maybeSingle(),
      supabase.from("invoices").select("*").eq("hotel_id", data.hotelId).order("created_at", { ascending: false }),
      supabase.from("ad_requests").select("*").eq("hotel_id", data.hotelId).order("created_at", { ascending: false }),
      supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("platform_settings").select("*").eq("id", true).maybeSingle(),
      supabase.from("data_requests").select("*").eq("hotel_id", data.hotelId).order("created_at", { ascending: false }),
    ]);

    const invoiceList = invoices.data ?? [];
    return {
      subscription: sub.data,
      plans: plans.data ?? [],
      invoices: invoiceList,
      ads: ads.data ?? [],
      dataRequests: dataReqs.data ?? [],
      settings: settings.data,
      outstanding: invoiceList.filter((i) => i.status === "unpaid").reduce((s, i) => s + Number(i.amount), 0),
    };
  });

export const requestAdPlacement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        hotelId: z.string().uuid(),
        placement: z.enum(["home_featured", "search_top", "banner"]),
        startDate: z.string().min(8).max(20),
        endDate: z.string().min(8).max(20),
        message: z.string().max(400).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelPermission(supabase, data.hotelId, userId, "hotel:settings");
    if (data.endDate < data.startDate) throw new Error("The end date must come after the start date");

    const { data: settings } = await supabase.from("platform_settings").select("*").eq("id", true).maybeSingle();
    const priceMap: Record<string, number> = {
      home_featured: Number(settings?.ad_price_home_featured ?? 0),
      search_top: Number(settings?.ad_price_search_top ?? 0),
      banner: Number(settings?.ad_price_banner ?? 0),
    };

    const { data: created, error } = await supabase
      .from("ad_requests")
      .insert({
        hotel_id: data.hotelId,
        placement: data.placement,
        start_date: data.startDate,
        end_date: data.endDate,
        message: data.message,
        quoted_price: priceMap[data.placement] ?? 0,
        requested_by: userId,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not send the request");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "hotel.ad_requested",
      resource: "ad_request",
      resource_id: created.id,
      new_value: { placement: data.placement, start: data.startDate, end: data.endDate },
    });

    return { id: created.id, quotedPrice: priceMap[data.placement] ?? 0 };
  });

export const requestDataAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        hotelId: z.string().uuid(),
        kind: z.enum(["export", "delete"]),
        scope: z.string().max(60).default("all"),
        note: z.string().max(400).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelPermission(supabase, data.hotelId, userId, "data:manage");

    const { data: created, error } = await supabase
      .from("data_requests")
      .insert({ hotel_id: data.hotelId, kind: data.kind, scope: data.scope, note: data.note, requested_by: userId })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not send the request");
    return { id: created.id };
  });

/* ------------------------------------------------------------------ */
/* Data export                                                         */
/* ------------------------------------------------------------------ */

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export const exportHotelData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        hotelId: z.string().uuid(),
        dataset: z.enum(["bookings", "guests", "payments", "folio_items"]),
        from: z.string().max(20).optional(),
        to: z.string().max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertHotelPermission(supabase, data.hotelId, context.userId, "data:manage");

    let query = supabase.from(data.dataset).select("*").eq("hotel_id", data.hotelId).limit(5000);
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00Z`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59Z`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return {
      filename: `${data.dataset}-${data.from ?? "all"}-${data.to ?? "all"}.csv`,
      csv: toCsv((rows ?? []) as unknown as Record<string, unknown>[]),
      count: (rows ?? []).length,
    };
  });
