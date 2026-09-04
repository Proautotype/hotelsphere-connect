import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(context: { supabase: unknown; userId: string }) {
  const client = context.supabase as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };
  const { data } = await client.rpc("is_platform_admin");
  if (data !== true) throw new Error("Platform admin access required");
}

/** Grant or revoke the platform_admin role for an existing account, by email. */
export const setPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ email: z.string().email().max(160), grant: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin.from("profiles").select("id, full_name, email").eq("email", data.email).maybeSingle();
    if (!profile) throw new Error("No account with that email. Ask them to sign up first.");
    if (data.grant && profile.id === context.userId) throw new Error("You are already a platform admin");

    if (data.grant) {
      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: profile.id, role: "platform_admin" });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      if (profile.id === context.userId) throw new Error("You cannot remove your own admin access");
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", profile.id).eq("role", "platform_admin");
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      action: data.grant ? "admin.role_granted" : "admin.role_revoked",
      resource: "user",
      resource_id: profile.id,
      new_value: { email: data.email, role: "platform_admin" },
    });

    return { userId: profile.id, name: profile.full_name, grant: data.grant };
  });

/** Curate the public discovery site: feature, list or unlist a hotel. */
export const setHotelDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        hotelId: z.string().uuid(),
        isFeatured: z.boolean().optional(),
        isPublicListed: z.boolean().optional(),
        acceptOnlineBookings: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const update: Record<string, unknown> = {};
    if (data.isFeatured !== undefined) update["is_featured"] = data.isFeatured;
    if (data.isPublicListed !== undefined) update["is_public_listed"] = data.isPublicListed;
    if (data.acceptOnlineBookings !== undefined) update["accept_online_bookings"] = data.acceptOnlineBookings;
    if (Object.keys(update).length === 0) return { updated: false };

    const { error } = await supabaseAdmin.from("hotels").update(update).eq("id", data.hotelId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: context.userId,
      action: "admin.discovery_updated",
      resource: "hotel",
      resource_id: data.hotelId,
      new_value: update,
    });

    return { updated: true };
  });

/** Platform-wide discovery + booking metrics for the admin overview. */
export const getDiscoveryStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [hotels, online, payments] = await Promise.all([
      supabaseAdmin.from("hotels").select("id, name, slug, city, status, is_featured, is_public_listed, accept_online_bookings").order("name"),
      supabaseAdmin.from("bookings").select("id, total, status, created_at").eq("source", "discovery").limit(1000),
      supabaseAdmin.from("payments").select("amount, status").eq("status", "successful").limit(2000),
    ]);

    const onlineBookings = online.data ?? [];
    return {
      hotels: hotels.data ?? [],
      listedCount: (hotels.data ?? []).filter((h) => h.is_public_listed && h.status === "active").length,
      featuredCount: (hotels.data ?? []).filter((h) => h.is_featured).length,
      onlineBookings: onlineBookings.length,
      onlineRevenue: onlineBookings.reduce((sum, b) => sum + Number(b.total), 0),
      collected: (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
    };
  });
