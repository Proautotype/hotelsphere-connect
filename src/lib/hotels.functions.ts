import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  hotel_type: z.string().min(1),
  description: z.string().max(2000).default(""),
  address: z.string().min(3).max(200),
  city: z.string().min(2).max(100),
  region: z.string().min(2).max(100),
  country: z.string().min(2).max(100).default("Ghana"),
  phone: z.string().max(30).default(""),
  email: z.string().email().max(120).optional(),
  website: z.string().url().max(200).optional(),
  currency: z.string().length(3).default("GHS"),
  timezone: z.string().max(80).default("Africa/Accra"),
  check_in_time: z.string().max(10).default("14:00"),
  check_out_time: z.string().max(10).default("11:00"),
  tax_percent: z.number().min(0).max(100).default(0),
  service_charge_percent: z.number().min(0).max(100).default(0),
  amenities: z.array(z.string()).default([]),
});

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

async function assertHotelAccess(supabase: unknown, hotelId: string) {
  const { data } = await (supabase as RpcClient).rpc("has_hotel_access", { _hotel_id: hotelId });
  if (data !== true) throw new Error("You do not have access to this hotel");
}

export const registerHotel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => registerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: slugError } = await supabase.from("hotels").select("id").eq("slug", data.slug).maybeSingle();
    if (slugError) throw new Error(slugError.message);
    if (existing) throw new Error("A hotel with this URL slug already exists.");

    const { data: hotel, error } = await supabase
      .from("hotels")
      .insert({
        name: data.name,
        slug: data.slug,
        hotel_type: data.hotel_type,
        description: data.description,
        address: data.address,
        city: data.city,
        region: data.region,
        country: data.country,
        phone: data.phone,
        email: data.email ?? null,
        website: data.website ?? null,
        currency: data.currency,
        timezone: data.timezone,
        check_in_time: data.check_in_time,
        check_out_time: data.check_out_time,
        tax_percent: data.tax_percent,
        service_charge_percent: data.service_charge_percent,
        amenities: data.amenities,
        owner_id: userId,
        status: "pending",
        onboarding_completed: false,
        onboarding_step: 1,
        is_public_listed: false,
        accept_online_bookings: false,
        show_availability: true,
        show_prices: true,
        rating: 0,
        room_count: 0,
      })
      .select("id")
      .single();
    if (error || !hotel) throw new Error(error?.message ?? "Hotel registration failed");

    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "hotel_owner" });

    const defaultMethods = ["cash", "mobile_money", "bank_transfer"].map((method) => ({
      hotel_id: hotel.id,
      method: method as "cash" | "mobile_money" | "bank_transfer",
      provider: method === "mobile_money" ? "paystack" : "manual",
      is_enabled: true,
      config: {},
    }));
    await supabaseAdmin.from("hotel_payment_methods").insert(defaultMethods);

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      hotel_id: hotel.id,
      title: "Hotel registered",
      body: `${data.name} has been submitted for approval.`,
      type: "hotel_submitted",
    });

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: hotel.id,
      user_id: userId,
      action: "hotel.registered",
      resource: "hotel",
      resource_id: hotel.id,
      new_value: data,
    });

    return { hotelId: hotel.id };
  });

export const setHotelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ hotelId: z.string().uuid(), status: z.enum(["pending", "active", "suspended", "rejected", "archived"]), isPublicListed: z.boolean().optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) throw new Error("Only platform admins can update hotel status");

    const update: Record<string, unknown> = { status: data.status };
    if (typeof data.isPublicListed === "boolean") update["is_public_listed"] = data.isPublicListed;
    if (data.status === "active") {
      update["accept_online_bookings"] = true;
      update["onboarding_completed"] = true;
      update["onboarding_step"] = 6;
    }

    const { error } = await supabaseAdmin.from("hotels").update(update).eq("id", data.hotelId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "hotel.status_changed",
      resource: "hotel",
      resource_id: data.hotelId,
      new_value: update,
    });

    return { ok: true };
  });

export const togglePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ autoApproveHotels: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) throw new Error("Only platform admins can change platform settings");

    const { error } = await supabaseAdmin.from("platform_settings").update({ auto_approve_hotels: data.autoApproveHotels }).eq("id", true);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "platform.setting_changed",
      resource: "platform_settings",
      new_value: data,
    });

    return { ok: true };
  });
