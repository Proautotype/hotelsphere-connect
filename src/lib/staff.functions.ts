import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_ROLES = ["hotel_admin", "manager", "receptionist", "cashier", "accountant", "housekeeping", "restaurant", "other"] as const;

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

/**
 * Only the hotel's own people can manage its team: the owner, or an active
 * hotel admin / member holding "staff:manage". Platform staff are excluded on
 * purpose — running the platform is not the same as running a hotel.
 */
async function assertCanManageTeam(supabase: unknown, hotelId: string, userId: string) {
  const client = supabase as RpcClient;
  const { data: owns } = await client.rpc("owns_hotel", { _hotel_id: hotelId });
  if (owns === true) return;

  const db = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { eq: (c: string, v: unknown) => { maybeSingle: () => Promise<{ data: { staff_role: string; permissions: string[] } | null }> } } };
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

  const allowed = member && (member.staff_role === "hotel_admin" || (member.permissions ?? []).includes("staff:manage"));
  if (!allowed) throw new Error("Only the hotel owner or a hotel admin can manage the team");
}

const inviteSchema = z.object({
  hotelId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  staffRole: z.enum(STAFF_ROLES),
  permissions: z.array(z.string().max(40)).max(40).default([]),
});

export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageTeam(supabase, data.hotelId, userId);

    const email = data.email.trim().toLowerCase();

    const { data: existing } = await supabase
      .from("hotel_members")
      .select("id")
      .eq("hotel_id", data.hotelId)
      .eq("invited_email", email)
      .maybeSingle();
    if (existing) throw new Error("This email has already been invited to the hotel");

    // Link immediately if the person already has an account.
    const { data: profile } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();

    const { data: member, error } = await supabase
      .from("hotel_members")
      .insert({
        hotel_id: data.hotelId,
        user_id: profile?.id ?? null,
        invited_email: email,
        full_name: data.fullName,
        staff_role: data.staffRole,
        permissions: data.permissions,
        is_active: true,
      })
      .select("id, user_id")
      .single();
    if (error || !member) throw new Error(error?.message ?? "Invitation failed");

    if (profile?.id) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: profile.id, role: "hotel_staff" }, { onConflict: "user_id,role" });
      await supabaseAdmin.from("notifications").insert({
        user_id: profile.id,
        hotel_id: data.hotelId,
        title: "You joined a hotel team",
        body: `You were added as ${data.staffRole.replace("_", " ")}.`,
        type: "staff_invited",
        link: "/dashboard",
      });
    }

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "staff.invited",
      resource: "hotel_member",
      resource_id: member.id,
      new_value: { email, staff_role: data.staffRole, permissions: data.permissions },
    });

    return { memberId: member.id, linked: Boolean(profile?.id) };
  });

const updateSchema = z.object({
  memberId: z.string().uuid(),
  staffRole: z.enum(STAFF_ROLES).optional(),
  permissions: z.array(z.string().max(40)).max(40).optional(),
  isActive: z.boolean().optional(),
});

export const updateStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabase
      .from("hotel_members")
      .select("id, hotel_id, staff_role, permissions, is_active")
      .eq("id", data.memberId)
      .single();
    if (!member) throw new Error("Staff member not found");
    await assertCanManageTeam(supabase, member.hotel_id, userId);

    const update: Record<string, unknown> = {};
    if (data.staffRole) update["staff_role"] = data.staffRole;
    if (data.permissions) update["permissions"] = data.permissions;
    if (typeof data.isActive === "boolean") update["is_active"] = data.isActive;
    if (Object.keys(update).length === 0) return { ok: true };

    const { error } = await supabase.from("hotel_members").update(update as never).eq("id", data.memberId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: member.hotel_id,
      user_id: userId,
      action: "staff.updated",
      resource: "hotel_member",
      resource_id: member.id,
      old_value: { staff_role: member.staff_role, permissions: member.permissions, is_active: member.is_active },
      new_value: update as Record<string, never>,
    });

    return { ok: true };
  });

export const removeStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ memberId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabase.from("hotel_members").select("id, hotel_id, full_name").eq("id", data.memberId).single();
    if (!member) throw new Error("Staff member not found");
    await assertCanManageTeam(supabase, member.hotel_id, userId);

    const { error } = await supabase.from("hotel_members").delete().eq("id", data.memberId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: member.hotel_id,
      user_id: userId,
      action: "staff.removed",
      resource: "hotel_member",
      resource_id: member.id,
      old_value: { full_name: member.full_name },
    });

    return { ok: true };
  });
