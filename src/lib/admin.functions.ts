import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcClient = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }> };

/** Full platform admin: can change money settings, approve hotels, grant roles. */
async function assertPlatformAdmin(context: { supabase: unknown }) {
  const { data } = await (context.supabase as RpcClient).rpc("is_platform_admin");
  if (data !== true) throw new Error("Platform admin access required");
}

/** Platform admin or platform support: read-only platform screens. */
async function assertPlatformTeam(context: { supabase: unknown }) {
  const { data } = await (context.supabase as RpcClient).rpc("is_platform_team");
  if (data !== true) throw new Error("Platform team access required");
}

async function logAudit(
  admin: { from: (t: "audit_logs") => { insert: (v: Record<string, unknown>) => Promise<unknown> } },
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  value?: Record<string, unknown>,
) {
  await admin.from("audit_logs").insert({
    user_id: userId,
    action,
    resource,
    resource_id: resourceId,
    new_value: value ?? {},
  });
}

/* ------------------------------------------------------------------ */
/* Platform team membership                                            */
/* ------------------------------------------------------------------ */

const PLATFORM_ROLES = ["platform_admin", "platform_support"] as const;

/**
 * Add or remove someone from the platform team.
 *
 * Guards, all enforced here (not just in the screen):
 *  - caller must be a full platform admin
 *  - the account must already exist
 *  - the account must not own or work at any hotel
 *  - the confirmation email must match exactly
 *  - the last platform admin can never be removed
 */
export const setPlatformTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email().max(160),
        confirmEmail: z.string().email().max(160),
        role: z.enum(PLATFORM_ROLES),
        grant: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const email = data.email.trim().toLowerCase();
    if (email !== data.confirmEmail.trim().toLowerCase()) {
      throw new Error("The confirmation email does not match");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email)
      .maybeSingle();
    if (!profile) throw new Error("No account with that email. Ask them to sign up first.");

    if (data.grant) {
      const [{ count: owned }, { count: memberships }] = await Promise.all([
        supabaseAdmin.from("hotels").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
        supabaseAdmin.from("hotel_members").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
      ]);
      if ((owned ?? 0) > 0 || (memberships ?? 0) > 0) {
        throw new Error("This account belongs to a hotel business. Hotel owners and staff can never join the platform team.");
      }

      const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: profile.id, role: data.role });
      if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    } else {
      if (data.role === "platform_admin") {
        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "platform_admin");
        if ((count ?? 0) <= 1) throw new Error("There must always be at least one platform admin");
        if (profile.id === context.userId) throw new Error("You cannot remove your own admin access");
      }
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", profile.id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    await logAudit(supabaseAdmin, context.userId, data.grant ? "platform.role_granted" : "platform.role_revoked", "user", profile.id, {
      email,
      role: data.role,
    });

    return { userId: profile.id, name: profile.full_name };
  });

/** Everyone currently on the platform team. */
export const listPlatformTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at")
      .in("role", ["platform_admin", "platform_support"]);
    const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids)
      : { data: [] as { id: string; full_name: string; email: string | null }[] };

    const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (roles ?? []).map((r) => ({
      userId: r.user_id,
      role: r.role as string,
      since: r.created_at,
      name: byId.get(r.user_id)?.full_name ?? "Unknown",
      email: byId.get(r.user_id)?.email ?? null,
    }));
  });

/* ------------------------------------------------------------------ */
/* Discovery curation                                                  */
/* ------------------------------------------------------------------ */

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

    const update: Record<string, boolean> = {};
    if (data.isFeatured !== undefined) update["is_featured"] = data.isFeatured;
    if (data.isPublicListed !== undefined) update["is_public_listed"] = data.isPublicListed;
    if (data.acceptOnlineBookings !== undefined) update["accept_online_bookings"] = data.acceptOnlineBookings;
    if (Object.keys(update).length === 0) return { updated: false };

    const { error } = await supabaseAdmin.from("hotels").update(update as Record<string, never>).eq("id", data.hotelId);
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

export const getDiscoveryStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [hotels, online, payments] = await Promise.all([
      supabaseAdmin.from("hotels").select("id, name, slug, city, status, is_featured, is_public_listed, accept_online_bookings").order("name"),
      supabaseAdmin.from("bookings").select("id, total, commission_amount, status, created_at").eq("source", "discovery").limit(1000),
      supabaseAdmin.from("payments").select("amount, status").eq("status", "successful").limit(2000),
    ]);

    const onlineBookings = online.data ?? [];
    return {
      hotels: hotels.data ?? [],
      listedCount: (hotels.data ?? []).filter((h) => h.is_public_listed && h.status === "active").length,
      featuredCount: (hotels.data ?? []).filter((h) => h.is_featured).length,
      onlineBookings: onlineBookings.length,
      onlineRevenue: onlineBookings.reduce((sum, b) => sum + Number(b.total), 0),
      commissionEarned: onlineBookings.reduce((sum, b) => sum + Number(b.commission_amount ?? 0), 0),
      collected: (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
    };
  });

/* ------------------------------------------------------------------ */
/* Plans, fees and commission                                          */
/* ------------------------------------------------------------------ */

const planSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
  description: z.string().max(400).default(""),
  billingPeriod: z.enum(["monthly", "quarterly", "annually"]),
  price: z.number().min(0).max(1_000_000),
  registrationFee: z.number().min(0).max(1_000_000),
  commissionPercent: z.number().min(0).max(100),
  maxRooms: z.number().int().min(1).max(10_000).nullable().default(null),
  features: z.array(z.string().max(80)).max(20).default([]),
  isActive: z.boolean().default(true),
});

export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => planSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      name: data.name,
      slug: data.slug,
      description: data.description,
      billing_period: data.billingPeriod,
      price: data.price,
      registration_fee: data.registrationFee,
      commission_percent: data.commissionPercent,
      max_rooms: data.maxRooms,
      features: data.features,
      is_active: data.isActive,
    };

    if (data.id) {
      const { error } = await supabaseAdmin.from("plans").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(supabaseAdmin, context.userId, "platform.plan_updated", "plan", data.id, row);
      return { id: data.id };
    }
    const { data: created, error } = await supabaseAdmin.from("plans").insert(row).select("id").single();
    if (error || !created) throw new Error(error?.message ?? "Could not save the plan");
    await logAudit(supabaseAdmin, context.userId, "platform.plan_created", "plan", created.id, row);
    return { id: created.id };
  });

export const setPlatformFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        commissionPercent: z.number().min(0).max(100).optional(),
        registrationFee: z.number().min(0).max(1_000_000).optional(),
        adPriceHomeFeatured: z.number().min(0).max(1_000_000).optional(),
        adPriceSearchTop: z.number().min(0).max(1_000_000).optional(),
        adPriceBanner: z.number().min(0).max(1_000_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const update: Record<string, number> = {};
    if (data.commissionPercent !== undefined) update["commission_percent"] = data.commissionPercent;
    if (data.registrationFee !== undefined) update["registration_fee"] = data.registrationFee;
    if (data.adPriceHomeFeatured !== undefined) update["ad_price_home_featured"] = data.adPriceHomeFeatured;
    if (data.adPriceSearchTop !== undefined) update["ad_price_search_top"] = data.adPriceSearchTop;
    if (data.adPriceBanner !== undefined) update["ad_price_banner"] = data.adPriceBanner;
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("platform_settings").update(update as Record<string, never>).eq("id", true);
    if (error) throw new Error(error.message);
    await logAudit(supabaseAdmin, context.userId, "platform.fees_updated", "platform_settings", null, update);
    return { ok: true };
  });

/** Put a hotel on a plan, set its renewal date, override its commission. */
export const setHotelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        hotelId: z.string().uuid(),
        planId: z.string().uuid().nullable().optional(),
        status: z.enum(["trial", "active", "past_due", "cancelled"]).optional(),
        registrationFeePaid: z.boolean().optional(),
        commissionPercentOverride: z.number().min(0).max(100).nullable().optional(),
        currentPeriodEnd: z.string().max(20).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row: Record<string, unknown> = { hotel_id: data.hotelId };
    if (data.planId !== undefined) row["plan_id"] = data.planId;
    if (data.status !== undefined) row["status"] = data.status;
    if (data.registrationFeePaid !== undefined) row["registration_fee_paid"] = data.registrationFeePaid;
    if (data.commissionPercentOverride !== undefined) row["commission_percent_override"] = data.commissionPercentOverride;
    if (data.currentPeriodEnd !== undefined) row["current_period_end"] = data.currentPeriodEnd;

    const { error } = await supabaseAdmin
      .from("hotel_subscriptions")
      .upsert(row as never, { onConflict: "hotel_id" });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: context.userId,
      action: "platform.subscription_updated",
      resource: "hotel_subscription",
      resource_id: data.hotelId,
      new_value: row as Record<string, never>,
    });
    return { ok: true };
  });

/** Plans, platform fee defaults, and every hotel with its plan + balance. */
export const getBillingOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [plans, settings, hotels, subs, invoices, commissions] = await Promise.all([
      supabaseAdmin.from("plans").select("*").order("sort_order"),
      supabaseAdmin.from("platform_settings").select("*").eq("id", true).maybeSingle(),
      supabaseAdmin.from("hotels").select("id, name, city, currency, status, room_count").order("name"),
      supabaseAdmin.from("hotel_subscriptions").select("*"),
      supabaseAdmin.from("invoices").select("*").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("bookings").select("hotel_id, total, commission_amount").eq("source", "discovery").limit(2000),
    ]);

    const subByHotel = new Map((subs.data ?? []).map((s) => [s.hotel_id, s]));
    const invoiceList = invoices.data ?? [];

    return {
      plans: plans.data ?? [],
      settings: settings.data,
      invoices: invoiceList,
      hotels: (hotels.data ?? []).map((h) => {
        const sub = subByHotel.get(h.id);
        const hotelInvoices = invoiceList.filter((i) => i.hotel_id === h.id);
        const rows = (commissions.data ?? []).filter((b) => b.hotel_id === h.id);
        return {
          ...h,
          subscription: sub ?? null,
          outstanding: hotelInvoices.filter((i) => i.status === "unpaid").reduce((s, i) => s + Number(i.amount), 0),
          paid: hotelInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0),
          onlineRevenue: rows.reduce((s, b) => s + Number(b.total), 0),
          commissionOwed: rows.reduce((s, b) => s + Number(b.commission_amount ?? 0), 0),
        };
      }),
    };
  });

/* ------------------------------------------------------------------ */
/* Invoices                                                            */
/* ------------------------------------------------------------------ */

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        hotelId: z.string().uuid(),
        kind: z.enum(["registration", "subscription", "commission", "advertising", "other"]),
        description: z.string().max(200).default(""),
        amount: z.number().min(0).max(10_000_000),
        dueDate: z.string().max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: hotel } = await supabaseAdmin.from("hotels").select("currency").eq("id", data.hotelId).maybeSingle();
    const number = `INV-${Date.now().toString(36).toUpperCase()}`;

    const { data: created, error } = await supabaseAdmin
      .from("invoices")
      .insert({
        hotel_id: data.hotelId,
        number,
        kind: data.kind,
        description: data.description,
        amount: data.amount,
        currency: hotel?.currency ?? "GHS",
        due_date: data.dueDate ?? null,
      })
      .select("id, number")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create the invoice");

    await supabaseAdmin.from("notifications").insert({
      hotel_id: data.hotelId,
      title: "New charge from Custard Hotels",
      body: `${data.description || data.kind} — ${data.amount}`,
      type: "invoice",
      link: "/billing",
    });
    await logAudit(supabaseAdmin, context.userId, "platform.invoice_created", "invoice", created.id, { ...data, number });
    return created;
  });

export const setInvoiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ invoiceId: z.string().uuid(), status: z.enum(["unpaid", "paid", "void"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("invoices")
      .update({ status: data.status, paid_at: data.status === "paid" ? new Date().toISOString() : null })
      .eq("id", data.invoiceId);
    if (error) throw new Error(error.message);
    await logAudit(supabaseAdmin, context.userId, "platform.invoice_updated", "invoice", data.invoiceId, { status: data.status });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Advertising and data requests                                       */
/* ------------------------------------------------------------------ */

export const getRequestQueues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformTeam(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [ads, dataReqs, hotels, settings] = await Promise.all([
      supabaseAdmin.from("ad_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("data_requests").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("hotels").select("id, name, city, currency"),
      supabaseAdmin.from("platform_settings").select("*").eq("id", true).maybeSingle(),
    ]);

    const byId = new Map((hotels.data ?? []).map((h) => [h.id, h]));
    return {
      ads: (ads.data ?? []).map((a) => ({ ...a, hotel: byId.get(a.hotel_id) ?? null })),
      dataRequests: (dataReqs.data ?? []).map((d) => ({ ...d, hotel: byId.get(d.hotel_id) ?? null })),
      settings: settings.data,
    };
  });

/** Approve or decline an advertising request. Approving drives the featured slots. */
export const reviewAdRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        status: z.enum(["approved", "declined", "cancelled"]),
        reason: z.string().max(300).default(""),
        price: z.number().min(0).max(1_000_000).optional(),
        raiseInvoice: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabaseAdmin.from("ad_requests").select("*").eq("id", data.requestId).maybeSingle();
    if (!request) throw new Error("Advertising request not found");

    const price = data.price ?? Number(request.quoted_price);
    const { error } = await supabaseAdmin
      .from("ad_requests")
      .update({
        status: data.status,
        decision_reason: data.reason,
        quoted_price: price,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    // Featured placement follows approved advertising, not a manual switch.
    if (request.placement === "home_featured") {
      await supabaseAdmin.from("hotels").update({ is_featured: data.status === "approved" }).eq("id", request.hotel_id);
    }

    if (data.status === "approved" && data.raiseInvoice && price > 0) {
      const { data: hotel } = await supabaseAdmin.from("hotels").select("currency").eq("id", request.hotel_id).maybeSingle();
      await supabaseAdmin.from("invoices").insert({
        hotel_id: request.hotel_id,
        number: `INV-${Date.now().toString(36).toUpperCase()}`,
        kind: "advertising",
        description: `Advertising: ${request.placement.replace(/_/g, " ")} ${request.start_date} to ${request.end_date}`,
        amount: price,
        currency: hotel?.currency ?? "GHS",
      });
    }

    await supabaseAdmin.from("notifications").insert({
      hotel_id: request.hotel_id,
      user_id: request.requested_by,
      title: data.status === "approved" ? "Advertising approved" : "Advertising request declined",
      body: data.reason || `Your ${request.placement.replace(/_/g, " ")} request was ${data.status}.`,
      type: "ad_request",
      link: "/promotions",
    });

    await logAudit(supabaseAdmin, context.userId, `platform.ad_${data.status}`, "ad_request", data.requestId, { price });
    return { ok: true };
  });

export const reviewDataRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        status: z.enum(["approved", "completed", "declined"]),
        note: z.string().max(300).default(""),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabaseAdmin.from("data_requests").select("*").eq("id", data.requestId).maybeSingle();
    if (!request) throw new Error("Data request not found");

    const { error } = await supabaseAdmin
      .from("data_requests")
      .update({ status: data.status, response_note: data.note, decided_by: context.userId, decided_at: new Date().toISOString() })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("notifications").insert({
      hotel_id: request.hotel_id,
      user_id: request.requested_by,
      title: `Data request ${data.status}`,
      body: data.note || `Your ${request.kind} request was ${data.status}.`,
      type: "data_request",
      link: "/settings",
    });

    await logAudit(supabaseAdmin, context.userId, `platform.data_request_${data.status}`, "data_request", data.requestId, {});
    return { ok: true };
  });
