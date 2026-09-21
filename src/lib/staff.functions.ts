import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STAFF_ROLES = [
  "hotel_admin",
  "manager",
  "receptionist",
  "cashier",
  "accountant",
  "housekeeping",
  "restaurant",
  "other",
] as const;

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

  const allowed =
    member &&
    (member.staff_role === "hotel_admin" || (member.permissions ?? []).includes("staff:manage"));
  if (!allowed) throw new Error("Only the hotel owner or a hotel admin can manage the team");
}

const inviteSchema = z.object({
  hotelId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(160),
  staffRole: z.enum(STAFF_ROLES),
  permissions: z.array(z.string().max(40)).max(40).default([]),
  // true when the manager wants to register a brand-new account for this
  // person (they don't have a platform account yet) and add them to the
  // hotel immediately. Requires `password`.
  createAccount: z.boolean().optional().default(false),
  password: z.string().min(8, "Password must be at least 8 characters").max(72).optional(),
});

export const inviteStaffMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inviteSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageTeam(supabase, data.hotelId, userId);

    const email = data.email.trim().toLowerCase();

    const { data: hotel } = await supabaseAdmin
      .from("hotels")
      .select("id, name, owner_id")
      .eq("id", data.hotelId)
      .maybeSingle();
    if (!hotel) throw new Error("Hotel not found");
    const hotelName = hotel.name || "your hotel";

    const { data: existing } = await supabaseAdmin
      .from("hotel_members")
      .select("id")
      .eq("hotel_id", data.hotelId)
      .eq("invited_email", email)
      .maybeSingle();
    if (existing) throw new Error("This email has already been invited to the hotel");

    // Anyone with an existing platform account is invited and must accept.
    // People without an account can be registered directly with a password.
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    /* ------------------------------------------------------------------ */
    /* Case 1 — the person already has a platform account: invite them.    */
    /* They are only linked to the hotel once they accept the invitation.  */
    /* ------------------------------------------------------------------ */
    if (profile?.id) {
      if (data.createAccount) {
        throw new Error(
          `An account already exists for ${email} — send an invitation and they will be added once they accept`,
        );
      }

      // Platform team members can never work at a hotel (mirrors the DB trigger).
      const { data: platformRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", profile.id)
        .in("role", ["platform_admin", "platform_support"])
        .maybeSingle();
      if (platformRole) throw new Error("Platform team accounts cannot be added as hotel staff");

      const { data: member, error } = await supabaseAdmin
        .from("hotel_members")
        .insert({
          hotel_id: data.hotelId,
          user_id: profile.id,
          invited_email: email,
          full_name: data.fullName,
          staff_role: data.staffRole,
          permissions: data.permissions,
          is_active: false,
          invite_status: "invited",
        })
        .select("id")
        .single();
      if (error || !member) throw new Error(error?.message ?? "Invitation failed");

      await supabaseAdmin.from("notifications").insert({
        user_id: profile.id,
        hotel_id: data.hotelId,
        title: `You're invited to join ${hotelName}`,
        body: `You've been invited to work at ${hotelName} as ${data.staffRole.replace("_", " ")}. Open the invitation and accept to get access.`,
        type: "staff_invited",
        link: `/invites/${member.id}`,
      });

      await supabaseAdmin.from("audit_logs").insert({
        hotel_id: data.hotelId,
        user_id: userId,
        action: "staff.invited",
        resource: "hotel_member",
        resource_id: member.id,
        new_value: {
          email,
          staff_role: data.staffRole,
          permissions: data.permissions,
          mode: "invite",
        },
      });

      return { memberId: member.id, mode: "invite", linked: false, hasAccount: true };
    }

    /* ------------------------------------------------------------------ */
    /* Case 2 — no account: register one directly with the supplied        */
    /* password and add the person to the hotel immediately.               */
    /* ------------------------------------------------------------------ */
    if (data.createAccount) {
      if (!data.password) throw new Error("Set a password so the new team member can sign in");

      let createdUserId: string | null = null;
      try {
        const created = await supabaseAdmin.auth.admin.createUser({
          email,
          password: data.password,
          email_confirm: true,
          user_metadata: { full_name: data.fullName },
        });
        createdUserId = created.data.user?.id ?? null;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not create the account";
        if (/already registered|already been registered|already exists|duplicate/i.test(message)) {
          throw new Error(
            `An account already exists for ${email} — send an invitation and they will be added once they accept`,
          );
        }
        throw new Error(message);
      }
      if (!createdUserId) throw new Error("Could not create the account");

      const { data: member, error } = await supabaseAdmin
        .from("hotel_members")
        .insert({
          hotel_id: data.hotelId,
          user_id: createdUserId,
          invited_email: email,
          full_name: data.fullName,
          staff_role: data.staffRole,
          permissions: data.permissions,
          is_active: true,
          invite_status: "accepted",
        })
        .select("id")
        .single();

      if (error || !member) {
        // Clean up the half-created account so we don't leave a broken user behind.
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch {
          /* best effort */
        }
        throw new Error(error?.message ?? "Could not add the staff member");
      }

      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: createdUserId, role: "hotel_staff" }, { onConflict: "user_id,role" });

      await supabaseAdmin.from("notifications").insert({
        user_id: createdUserId,
        hotel_id: data.hotelId,
        title: `Your ${hotelName} account is ready`,
        body: `You've been added to ${hotelName} as ${data.staffRole.replace("_", " ")}. Sign in with the email and password your manager shared with you.`,
        type: "staff_invited",
        link: "/dashboard",
      });

      await supabaseAdmin.from("audit_logs").insert({
        hotel_id: data.hotelId,
        user_id: userId,
        action: "staff.registered",
        resource: "hotel_member",
        resource_id: member.id,
        new_value: {
          email,
          staff_role: data.staffRole,
          permissions: data.permissions,
          mode: "register",
          account_created_by: userId,
        },
      });

      return { memberId: member.id, mode: "register", linked: true, hasAccount: false };
    }

    /* ------------------------------------------------------------------ */
    /* Case 3 — legacy: no account and no password. The invite links the   */
    /* person as soon as they sign up with this email.                     */
    /* ------------------------------------------------------------------ */
    const { data: member, error } = await supabaseAdmin
      .from("hotel_members")
      .insert({
        hotel_id: data.hotelId,
        user_id: null,
        invited_email: email,
        full_name: data.fullName,
        staff_role: data.staffRole,
        permissions: data.permissions,
        is_active: true,
        invite_status: "invited",
      })
      .select("id")
      .single();
    if (error || !member) throw new Error(error?.message ?? "Invitation failed");

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "staff.invited",
      resource: "hotel_member",
      resource_id: member.id,
      new_value: {
        email,
        staff_role: data.staffRole,
        permissions: data.permissions,
        mode: "pending_signup",
      },
    });

    return { memberId: member.id, mode: "pending_signup", linked: false, hasAccount: false };
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

    const { error } = await supabaseAdmin
      .from("hotel_members")
      .update(update as never)
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: member.hotel_id,
      user_id: userId,
      action: "staff.updated",
      resource: "hotel_member",
      resource_id: member.id,
      old_value: {
        staff_role: member.staff_role,
        permissions: member.permissions,
        is_active: member.is_active,
      },
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

    const { data: member } = await supabase
      .from("hotel_members")
      .select("id, hotel_id, full_name")
      .eq("id", data.memberId)
      .single();
    if (!member) throw new Error("Staff member not found");
    await assertCanManageTeam(supabase, member.hotel_id, userId);

    const { error } = await supabaseAdmin.from("hotel_members").delete().eq("id", data.memberId);
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
/* ------------------------------------------------------------------ */
/* Invitation helpers                                                  */
/* ------------------------------------------------------------------ */

const lookupRecipientSchema = z.object({
  hotelId: z.string().uuid(),
  email: z.string().email().max(160),
});

/**
 * Lets the staff manager know whether an email already has a platform
 * account (so the UI can offer "create an account" vs "send invitation").
 */
export const lookupStaffRecipient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => lookupRecipientSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertCanManageTeam(supabase, data.hotelId, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { data: existing } = await supabaseAdmin
      .from("hotel_members")
      .select("id, user_id, invite_status")
      .eq("hotel_id", data.hotelId)
      .eq("invited_email", email)
      .maybeSingle();

    return {
      hasAccount: Boolean(profile?.id),
      alreadyInvited: Boolean(existing?.id),
      existingStatus: existing?.invite_status ?? "none",
    };
  });
const getInvitationSchema = z.object({
  memberId: z.string().uuid(),
});

/**
 * Loads the details shown on the accept/decline page. Uses the admin
 * client because the invitee cannot read the hotel row through RLS yet.
 */
export const getStaffInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => getInvitationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("hotel_members")
      .select(
        "id, hotel_id, user_id, invited_email, full_name, staff_role, permissions, is_active, invite_status, created_at",
      )
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member) throw new Error("This invitation no longer exists");

    const { data: hotel } = await supabaseAdmin
      .from("hotels")
      .select("name, logo_url, slug, city")
      .eq("id", member.hotel_id)
      .maybeSingle();

    // Does this invitation belong to the signed-in person?
    let isMine = Boolean(member.user_id && member.user_id === userId);
    if (!isMine && !member.user_id && member.invited_email) {
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser?.user?.email?.trim().toLowerCase();
      isMine = Boolean(email && email === member.invited_email.trim().toLowerCase());
    }

    return {
      memberId: member.id,
      hotel: hotel
        ? { name: hotel.name, logoUrl: hotel.logo_url, slug: hotel.slug, city: hotel.city }
        : null,
      fullName: member.full_name,
      email: member.invited_email,
      staffRole: member.staff_role,
      permissions: member.permissions,
      isActive: member.is_active,
      inviteStatus: member.invite_status,
      isMine,
      userId,
    };
  });

const respondInvitationSchema = z.object({
  memberId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});

/**
 * Accepts or declines a staff invitation. Accepting links the signed-in
 * account to the hotel with the role + permissions the manager chose and
 * grants the `hotel_staff` app role. Declining removes the pending row so
 * the manager can invite the email again.
 */
export const respondStaffInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => respondInvitationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: member } = await supabaseAdmin
      .from("hotel_members")
      .select(
        "id, hotel_id, user_id, invited_email, full_name, staff_role, permissions, is_active, invite_status",
      )
      .eq("id", data.memberId)
      .maybeSingle();
    if (!member) throw new Error("This invitation no longer exists");

    // The invitation must be addressed to the signed-in person.
    let isMine = Boolean(member.user_id && member.user_id === userId);
    if (!isMine && !member.user_id && member.invited_email) {
      const { data: authUser } = await supabase.auth.getUser();
      const email = authUser?.user?.email?.trim().toLowerCase();
      isMine = Boolean(email && email === member.invited_email.trim().toLowerCase());
    }
    if (!isMine) throw new Error("This invitation belongs to a different account");

    if (member.invite_status === "accepted" && member.is_active) {
      return { ok: true, already: true, action: data.action };
    }

    if (data.action === "accept") {
      const { error } = await supabaseAdmin
        .from("hotel_members")
        .update({ user_id: userId, is_active: true, invite_status: "accepted" })
        .eq("id", data.memberId);
      if (error) throw new Error(error.message);

      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "hotel_staff" }, { onConflict: "user_id,role" });

      await supabaseAdmin.from("audit_logs").insert({
        hotel_id: member.hotel_id,
        user_id: userId,
        action: "staff.accepted",
        resource: "hotel_member",
        resource_id: member.id,
        new_value: { staff_role: member.staff_role, permissions: member.permissions },
      });

      // Let the owner know the team grew.
      const { data: hotel } = await supabaseAdmin
        .from("hotels")
        .select("owner_id, name")
        .eq("id", member.hotel_id)
        .maybeSingle();
      if (hotel?.owner_id && hotel.owner_id !== userId) {
        await supabaseAdmin.from("notifications").insert({
          user_id: hotel.owner_id,
          hotel_id: member.hotel_id,
          title: "A new team member joined",
          body: `${member.full_name || member.invited_email} accepted the invitation to work at ${hotel.name}.`,
          type: "staff",
          link: "/staff",
        });
      }

      return { ok: true, already: false, action: "accept" };
    }

    // Decline: remove the pending row so the email is free for a re-invite.
    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: member.hotel_id,
      user_id: userId,
      action: "staff.declined",
      resource: "hotel_member",
      resource_id: member.id,
      old_value: { email: member.invited_email, staff_role: member.staff_role },
    });
    const { error } = await supabaseAdmin.from("hotel_members").delete().eq("id", data.memberId);
    if (error) throw new Error(error.message);

    return { ok: true, already: false, action: "decline" };
  });
