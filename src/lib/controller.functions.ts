// Controller module — the school side of Custard, and the hostel side of
// working with a school.
//
// Hybrid v1: platform admins create the school record and link its staff
// accounts. Those staff post accommodation requests and assign students.
// Hostel owners answer with offers and check students in, which creates an
// ordinary long-term booking on the hostel's side.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const round2 = (value: number) => Math.round(value * 100) / 100;

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
};

/** Full platform admin: creates schools and links their staff accounts. */
async function assertPlatformAdmin(supabase: unknown) {
  const { data } = await (supabase as RpcClient).rpc("is_platform_admin");
  if (data !== true) throw new Error("Platform admin access required");
}

/** Someone who works at this school (or a platform admin). */
async function assertControllerAccess(supabase: unknown, controllerId: string) {
  const { data } = await (supabase as RpcClient).rpc("has_controller_access", {
    _controller_id: controllerId,
  });
  if (data !== true) throw new Error("You do not have access to this school");
}

/** Someone who works at this hotel. Mirrors the helper in the other modules. */
async function assertHotelAccess(supabase: unknown, hotelId: string) {
  const { data } = await (supabase as RpcClient).rpc("has_hotel_access", { _hotel_id: hotelId });
  if (data !== true) throw new Error("You do not have access to this hotel");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function generateRef(prefix: string) {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}${rand}`;
}

/* ------------------------------------------------------------------ */
/* Platform admin: schools and their staff                             */
/* ------------------------------------------------------------------ */

const createControllerSchema = z.object({
  name: z.string().min(2).max(160),
  kind: z.enum(["university", "college", "training", "other"]).default("university"),
  email: z.string().email().max(160).optional(),
  phone: z.string().max(30).optional(),
  website: z.string().max(200).optional(),
  address: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  country: z.string().max(80).default("Ghana"),
});

export const createController = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createControllerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPlatformAdmin(supabase);

    const base = slugify(data.name) || "school";
    let slug = base;
    for (let attempt = 1; attempt < 20; attempt += 1) {
      const { data: clash } = await supabaseAdmin
        .from("controllers")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${attempt + 1}`;
    }

    const { data: created, error } = await supabaseAdmin
      .from("controllers")
      .insert({
        name: data.name,
        slug,
        kind: data.kind,
        email: data.email ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        address: data.address,
        city: data.city,
        country: data.country,
        status: "active",
        created_by: userId,
      })
      .select("id, name, slug")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create this school");

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "controller.created",
      resource: "controller",
      resource_id: created.id,
      new_value: { name: created.name, slug: created.slug },
    });

    return { id: created.id, name: created.name, slug: created.slug };
  });

const updateControllerStatusSchema = z.object({
  controllerId: z.string().uuid(),
  status: z.enum(["pending", "active", "suspended", "rejected"]),
});

export const updateControllerStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateControllerStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPlatformAdmin(supabase);

    const { error } = await supabaseAdmin
      .from("controllers")
      .update({ status: data.status })
      .eq("id", data.controllerId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "controller.status_changed",
      resource: "controller",
      resource_id: data.controllerId,
      new_value: { status: data.status },
    });

    return { ok: true };
  });

const addControllerMemberSchema = z.object({
  controllerId: z.string().uuid(),
  email: z.string().email().max(160),
  fullName: z.string().min(2).max(120),
  role: z.enum(["admin", "admissions", "finance"]).default("admin"),
  // Set when the person has no Custard account yet and we should make one.
  createAccount: z.boolean().default(false),
  password: z.string().min(8, "Password must be at least 8 characters").max(72).optional(),
});

/**
 * Link a school-staff account to a school. Mirrors inviteStaffMember: if the
 * person already has an account we attach it, otherwise we can register one for
 * them and attach it in the same step.
 */
export const addControllerMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => addControllerMemberSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPlatformAdmin(supabase);

    const email = data.email.trim().toLowerCase();

    const { data: school } = await supabaseAdmin
      .from("controllers")
      .select("id, name")
      .eq("id", data.controllerId)
      .maybeSingle();
    if (!school) throw new Error("School not found");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let memberUserId = profile?.id ?? null;
    let createdUserId: string | null = null;

    if (!memberUserId) {
      if (!data.createAccount)
        throw new Error(
          `No Custard account exists for ${email} — tick "create an account" and set a password`,
        );
      if (!data.password) throw new Error("Set a password so the new member can sign in");

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
        if (/already registered|already been registered|already exists|duplicate/i.test(message))
          throw new Error(`An account already exists for ${email} — add them without a password`);
        throw new Error(message);
      }
      if (!createdUserId) throw new Error("Could not create the account");
      memberUserId = createdUserId;
    }

    const { data: member, error } = await supabaseAdmin
      .from("controller_members")
      .insert({
        controller_id: data.controllerId,
        user_id: memberUserId,
        role: data.role,
        is_active: true,
      })
      .select("id")
      .single();

    if (error || !member) {
      // Do not leave a half-made account behind if the link failed.
      if (createdUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(createdUserId);
        } catch {
          /* best effort */
        }
      }
      throw new Error(
        /duplicate|unique/i.test(error?.message ?? "")
          ? "That account is already on this school's team"
          : (error?.message ?? "Could not add this member"),
      );
    }

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: memberUserId, role: "controller" }, { onConflict: "user_id,role" });

    await supabaseAdmin.from("notifications").insert({
      user_id: memberUserId,
      title: `You were added to ${school.name}`,
      body: "Open the school workspace to post accommodation requests and assign students.",
      type: "controller",
      link: "/school",
    });

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "controller.member_added",
      resource: "controller",
      resource_id: data.controllerId,
      new_value: { email, role: data.role, created_account: Boolean(createdUserId) },
    });

    return { memberId: member.id, createdAccount: Boolean(createdUserId) };
  });

export const listControllers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPlatformAdmin(supabase);

    const { data: schools } = await supabaseAdmin
      .from("controllers")
      .select("*")
      .order("created_at", { ascending: false });

    // controller_members.user_id points at auth.users, not profiles, so there is
    // no relationship for PostgREST to follow — look the names up separately.
    const { data: members } = await supabaseAdmin
      .from("controller_members")
      .select("id, controller_id, role, is_active, user_id");

    const userIds = Array.from(new Set((members ?? []).map((m) => m.user_id)));
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] };
    const byUser = new Map((profiles ?? []).map((p) => [p.id, p]));

    return {
      schools: schools ?? [],
      members: (members ?? []).map((m) => ({
        ...m,
        full_name: byUser.get(m.user_id)?.full_name ?? "",
        email: byUser.get(m.user_id)?.email ?? "",
      })),
    };
  });

/* ------------------------------------------------------------------ */
/* School side: requests, students, accepting offers                   */
/* ------------------------------------------------------------------ */

const saveRequestSchema = z.object({
  requestId: z.string().uuid().optional(),
  controllerId: z.string().uuid(),
  title: z.string().min(2).max(160),
  semester: z.string().max(80).default(""),
  periodStart: z.string().date().nullable().optional(),
  periodEnd: z.string().date().nullable().optional(),
  studentsCount: z.number().int().min(0).max(100_000).default(0),
  budgetPerStudent: z.number().nonnegative().nullable().optional(),
  genderMix: z.string().max(40).default(""),
  preferredCity: z.string().max(100).default(""),
  notes: z.string().max(2000).default(""),
});

export const saveAccommodationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveRequestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertControllerAccess(supabase, data.controllerId);

    if (data.periodStart && data.periodEnd && data.periodEnd <= data.periodStart)
      throw new Error("The period must end after it starts");

    const row = {
      controller_id: data.controllerId,
      title: data.title,
      semester: data.semester,
      period_start: data.periodStart ?? null,
      period_end: data.periodEnd ?? null,
      students_count: data.studentsCount,
      budget_per_student: data.budgetPerStudent ?? null,
      gender_mix: data.genderMix,
      preferred_city: data.preferredCity,
      notes: data.notes,
    };

    if (data.requestId) {
      const { data: existing } = await supabase
        .from("accommodation_requests")
        .select("id, controller_id, status")
        .eq("id", data.requestId)
        .single();
      if (!existing) throw new Error("Request not found");
      await assertControllerAccess(supabase, existing.controller_id);
      if (["completed", "cancelled"].includes(existing.status))
        throw new Error("This request is closed");

      const { error } = await supabase
        .from("accommodation_requests")
        .update(row as never)
        .eq("id", data.requestId);
      if (error) throw new Error(error.message);
      return { requestId: data.requestId };
    }

    const { data: created, error } = await supabase
      .from("accommodation_requests")
      .insert({ ...row, status: "draft", created_by: userId })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not save this request");
    return { requestId: created.id };
  });

const requestActionSchema = z.object({ requestId: z.string().uuid() });

/** Publishing opens the request to hostels and notifies the affiliated ones. */
export const publishAccommodationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => requestActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabase
      .from("accommodation_requests")
      .select("id, controller_id, title, status, preferred_city")
      .eq("id", data.requestId)
      .single();
    if (!request) throw new Error("Request not found");
    await assertControllerAccess(supabase, request.controller_id);
    if (request.status !== "draft") throw new Error("Only a draft request can be published");

    const { error } = await supabase
      .from("accommodation_requests")
      .update({ status: "published" })
      .eq("id", data.requestId)
      .eq("status", "draft");
    if (error) throw new Error(error.message);

    const { data: school } = await supabaseAdmin
      .from("controllers")
      .select("name")
      .eq("id", request.controller_id)
      .maybeSingle();

    const { data: affiliations } = await supabaseAdmin
      .from("hotel_controller_affiliations")
      .select("hotel_id")
      .eq("controller_id", request.controller_id)
      .in("status", ["pending", "active"]);

    if (affiliations && affiliations.length > 0) {
      await supabaseAdmin.from("notifications").insert(
        affiliations.map((a) => ({
          hotel_id: a.hotel_id,
          title: "New accommodation request",
          body: `${school?.name ?? "A school"} published "${request.title}".`,
          type: "allocation",
          link: "/allocations",
        })),
      );
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "accommodation_request.published",
      resource: "accommodation_request",
      resource_id: request.id,
      new_value: { title: request.title },
    });

    return { ok: true };
  });

export const cancelAccommodationRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => requestActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabase
      .from("accommodation_requests")
      .select("id, controller_id, status")
      .eq("id", data.requestId)
      .single();
    if (!request) throw new Error("Request not found");
    await assertControllerAccess(supabase, request.controller_id);
    if (["completed", "cancelled"].includes(request.status))
      throw new Error("This request is already closed");

    const { error } = await supabase
      .from("accommodation_requests")
      .update({ status: "cancelled" })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    await supabase
      .from("allocation_offers")
      .update({ status: "withdrawn" })
      .eq("request_id", data.requestId)
      .eq("status", "offered");

    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "accommodation_request.cancelled",
      resource: "accommodation_request",
      resource_id: request.id,
    });

    return { ok: true };
  });

const saveStudentSchema = z.object({
  studentId: z.string().uuid().optional(),
  controllerId: z.string().uuid(),
  fullName: z.string().min(2).max(160),
  studentRef: z.string().max(60).default(""),
  program: z.string().max(120).default(""),
  levelYear: z.string().max(40).default(""),
  gender: z.string().max(20).default(""),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(160).optional().or(z.literal("")),
  guardianName: z.string().max(120).default(""),
  guardianPhone: z.string().max(30).default(""),
  notes: z.string().max(1000).default(""),
});

export const saveStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveStudentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertControllerAccess(supabase, data.controllerId);

    const row = {
      controller_id: data.controllerId,
      full_name: data.fullName,
      student_ref: data.studentRef,
      program: data.program,
      level_year: data.levelYear,
      gender: data.gender,
      phone: data.phone || null,
      email: data.email || null,
      guardian_name: data.guardianName,
      guardian_phone: data.guardianPhone,
      notes: data.notes,
    };

    if (data.studentId) {
      const { error } = await supabase
        .from("students")
        .update(row as never)
        .eq("id", data.studentId)
        .eq("controller_id", data.controllerId);
      if (error) throw new Error(error.message);
      return { studentId: data.studentId };
    }

    const { data: created, error } = await supabase
      .from("students")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not save this student");
    return { studentId: created.id };
  });

const acceptOfferSchema = z.object({ offerId: z.string().uuid() });

/**
 * Accepting an offer settles which hostel the students go to. Every other offer
 * on the request is declined, so a bed is never promised twice.
 */
export const acceptAllocationOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => acceptOfferSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: offer } = await supabase
      .from("allocation_offers")
      .select("id, request_id, hotel_id, status, price_per_student, beds_available")
      .eq("id", data.offerId)
      .single();
    if (!offer) throw new Error("Offer not found");
    if (offer.status !== "offered") throw new Error("This offer is no longer open");

    const { data: request } = await supabase
      .from("accommodation_requests")
      .select("id, controller_id, title, status")
      .eq("id", offer.request_id)
      .single();
    if (!request) throw new Error("Request not found");
    await assertControllerAccess(supabase, request.controller_id);
    if (!["published", "allocating"].includes(request.status))
      throw new Error("This request is not open for allocation");

    const { error } = await supabase
      .from("allocation_offers")
      .update({ status: "accepted" })
      .eq("id", data.offerId)
      .eq("status", "offered");
    if (error) throw new Error(error.message);

    await supabase
      .from("allocation_offers")
      .update({ status: "declined" })
      .eq("request_id", offer.request_id)
      .eq("status", "offered")
      .neq("id", data.offerId);

    await supabase
      .from("accommodation_requests")
      .update({ status: "allocating" })
      .eq("id", offer.request_id);

    await supabaseAdmin.from("notifications").insert({
      hotel_id: offer.hotel_id,
      title: "Your offer was accepted",
      body: `Your beds for "${request.title}" were accepted. Assign rooms and check students in from Schools & allocations.`,
      type: "allocation",
      link: "/allocations",
    });

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: offer.hotel_id,
      user_id: userId,
      action: "allocation_offer.accepted",
      resource: "allocation_offer",
      resource_id: offer.id,
      new_value: { request_id: offer.request_id },
    });

    return { ok: true };
  });

const assignStudentsSchema = z.object({
  offerId: z.string().uuid(),
  studentIds: z.array(z.string().uuid()).min(1).max(500),
});

/** Put named students against an accepted offer, ready for the hostel to check in. */
export const assignStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => assignStudentsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: offer } = await supabase
      .from("allocation_offers")
      .select("id, request_id, hotel_id, status, price_per_student, beds_available")
      .eq("id", data.offerId)
      .single();
    if (!offer) throw new Error("Offer not found");
    if (offer.status !== "accepted") throw new Error("Accept this offer before assigning students");

    const { data: request } = await supabase
      .from("accommodation_requests")
      .select("id, controller_id")
      .eq("id", offer.request_id)
      .single();
    if (!request) throw new Error("Request not found");
    await assertControllerAccess(supabase, request.controller_id);

    // Only this school's students, and only ones not already on this request.
    const { data: students } = await supabase
      .from("students")
      .select("id")
      .eq("controller_id", request.controller_id)
      .in("id", data.studentIds);
    const validIds = (students ?? []).map((s) => s.id);
    if (validIds.length === 0) throw new Error("None of those students belong to this school");

    const { data: already } = await supabase
      .from("student_allocations")
      .select("student_id")
      .eq("request_id", offer.request_id)
      .not("status", "eq", "cancelled");
    const taken = new Set((already ?? []).map((a) => a.student_id));
    const fresh = validIds.filter((id) => !taken.has(id));
    if (fresh.length === 0) return { assigned: 0 };

    if (offer.beds_available > 0 && taken.size + fresh.length > offer.beds_available)
      throw new Error(
        `This offer holds ${offer.beds_available} beds and ${taken.size} are already assigned`,
      );

    const { error } = await supabase.from("student_allocations").insert(
      fresh.map((studentId) => ({
        request_id: offer.request_id,
        offer_id: offer.id,
        student_id: studentId,
        controller_id: request.controller_id,
        hotel_id: offer.hotel_id,
        price: offer.price_per_student,
        status: "confirmed",
      })),
    );
    if (error) throw new Error(error.message);

    return { assigned: fresh.length };
  });

/* ------------------------------------------------------------------ */
/* Hostel side: offers, allocations, checking students in              */
/* ------------------------------------------------------------------ */

const hotelScopeSchema = z.object({ hotelId: z.string().uuid() });

/** Open requests a hostel can bid on, with whatever it has already offered. */
export const listPublishedRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => hotelScopeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertHotelAccess(supabase, data.hotelId);

    const { data: requests } = await supabase
      .from("accommodation_requests")
      .select("*")
      .in("status", ["published", "allocating", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(100);

    const controllerIds = Array.from(new Set((requests ?? []).map((r) => r.controller_id)));
    const { data: schools } = controllerIds.length
      ? await supabaseAdmin
          .from("controllers")
          .select("id, name, city, kind")
          .in("id", controllerIds)
      : { data: [] };
    const schoolById = new Map((schools ?? []).map((c) => [c.id, c]));

    const { data: myOffers } = await supabase
      .from("allocation_offers")
      .select("*")
      .eq("hotel_id", data.hotelId);
    const offerByRequest = new Map((myOffers ?? []).map((o) => [o.request_id, o]));

    return (requests ?? []).map((r) => ({
      ...r,
      school: schoolById.get(r.controller_id) ?? null,
      myOffer: offerByRequest.get(r.id) ?? null,
    }));
  });

const saveOfferSchema = z.object({
  hotelId: z.string().uuid(),
  requestId: z.string().uuid(),
  bedsAvailable: z.number().int().min(0).max(100_000),
  pricePerStudent: z.number().nonnegative(),
  notes: z.string().max(1000).default(""),
});

/** Offer beds against a request. Offering also affiliates the hostel with the school. */
export const createAllocationOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveOfferSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertHotelAccess(supabase, data.hotelId);

    const { data: request } = await supabase
      .from("accommodation_requests")
      .select("id, controller_id, status, title")
      .eq("id", data.requestId)
      .single();
    if (!request) throw new Error("Request not found");
    if (!["published", "allocating"].includes(request.status))
      throw new Error("This request is not accepting offers");

    // Working together makes them affiliated, so the school's next request
    // reaches this hostel directly.
    await supabaseAdmin.from("hotel_controller_affiliations").upsert(
      {
        controller_id: request.controller_id,
        hotel_id: data.hotelId,
        status: "active",
        created_by: userId,
      },
      { onConflict: "controller_id,hotel_id" },
    );

    const { data: offer, error } = await supabase
      .from("allocation_offers")
      .upsert(
        {
          request_id: data.requestId,
          hotel_id: data.hotelId,
          beds_available: data.bedsAvailable,
          price_per_student: data.pricePerStudent,
          notes: data.notes,
          status: "offered",
          created_by: userId,
        },
        { onConflict: "request_id,hotel_id" },
      )
      .select("id")
      .single();
    if (error || !offer) throw new Error(error?.message ?? "Could not send this offer");

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "allocation_offer.sent",
      resource: "allocation_offer",
      resource_id: offer.id,
      new_value: { request_id: data.requestId, beds: data.bedsAvailable },
    });

    return { offerId: offer.id };
  });

const withdrawOfferSchema = z.object({ offerId: z.string().uuid() });

export const withdrawAllocationOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => withdrawOfferSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: offer } = await supabase
      .from("allocation_offers")
      .select("id, hotel_id, status")
      .eq("id", data.offerId)
      .single();
    if (!offer) throw new Error("Offer not found");
    await assertHotelAccess(supabase, offer.hotel_id);
    if (offer.status !== "offered") throw new Error("Only an open offer can be withdrawn");

    const { error } = await supabase
      .from("allocation_offers")
      .update({ status: "withdrawn" })
      .eq("id", data.offerId)
      .eq("status", "offered");
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Students a school has confirmed into this hostel, with their check-in state. */
export const listAllocationsForHotel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => hotelScopeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertHotelAccess(supabase, data.hotelId);

    const { data: allocations } = await supabase
      .from("student_allocations")
      .select("*, students(full_name, student_ref, gender, phone, email), rooms(room_number)")
      .eq("hotel_id", data.hotelId)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: true })
      .limit(500);

    const requestIds = Array.from(
      new Set((allocations ?? []).map((a) => a.request_id).filter((id): id is string => !!id)),
    );
    const { data: requests } = requestIds.length
      ? await supabaseAdmin
          .from("accommodation_requests")
          .select("id, title, semester, period_start, period_end, controller_id")
          .in("id", requestIds)
      : { data: [] };
    const requestById = new Map((requests ?? []).map((r) => [r.id, r]));

    const controllerIds = Array.from(new Set((requests ?? []).map((r) => r.controller_id)));
    const { data: schools } = controllerIds.length
      ? await supabaseAdmin.from("controllers").select("id, name").in("id", controllerIds)
      : { data: [] };
    const schoolById = new Map((schools ?? []).map((c) => [c.id, c]));

    return (allocations ?? []).map((a) => {
      const request = a.request_id ? (requestById.get(a.request_id) ?? null) : null;
      return {
        ...a,
        request,
        school: request ? (schoolById.get(request.controller_id) ?? null) : null,
      };
    });
  });

const checkInAllocationSchema = z.object({
  allocationId: z.string().uuid(),
  roomId: z.string().uuid(),
  bedNumber: z.string().max(20).optional(),
});

/**
 * Move a student in. This is where the school side meets the hostel side: it
 * creates (or joins) an ordinary per-stay booking on the room, adds the student
 * as an occupant, and marks the room occupied. The stay ends when the request's
 * period ends, or stays open if the school gave no end date.
 */
export const checkInStudentAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => checkInAllocationSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: allocation } = await supabase
      .from("student_allocations")
      .select("*, students(full_name, phone, email)")
      .eq("id", data.allocationId)
      .single();
    if (!allocation) throw new Error("Allocation not found");
    await assertHotelAccess(supabase, allocation.hotel_id);
    if (allocation.status === "checked_in") throw new Error("This student is already checked in");
    if (allocation.status !== "confirmed")
      throw new Error("Only a confirmed allocation can be checked in");

    const student = allocation.students as unknown as {
      full_name: string;
      phone: string | null;
      email: string | null;
    } | null;
    if (!student) throw new Error("Student record is missing");

    const { data: room } = await supabase
      .from("rooms")
      .select("id, hotel_id, room_type_id")
      .eq("id", data.roomId)
      .eq("hotel_id", allocation.hotel_id)
      .maybeSingle();
    if (!room) throw new Error("That room does not belong to this hostel");

    const { data: roomType } = room.room_type_id
      ? await supabase
          .from("room_types")
          .select("id, max_guests, per_stay_price, base_price")
          .eq("id", room.room_type_id)
          .maybeSingle()
      : { data: null };

    const price = round2(
      Number(allocation.price ?? roomType?.per_stay_price ?? roomType?.base_price ?? 0),
    );

    const { data: request } = allocation.request_id
      ? await supabaseAdmin
          .from("accommodation_requests")
          .select("id, title, semester, period_start, period_end")
          .eq("id", allocation.request_id)
          .maybeSingle()
      : { data: null };

    const todayIso = new Date().toISOString().slice(0, 10);
    const checkIn =
      request?.period_start && request.period_start > todayIso ? request.period_start : todayIso;
    const checkOut = request?.period_end ?? null;

    // A dorm only holds so many people, whichever stay they arrived on.
    const capacity = Number(roomType?.max_guests ?? 0);
    if (capacity > 0) {
      const { data: living } = await supabase
        .from("occupancies")
        .select("id")
        .eq("room_id", data.roomId)
        .in("status", ["reserved", "checked_in"]);
      if ((living ?? []).length + 1 > capacity)
        throw new Error(`Room is full — it sleeps ${capacity}`);
    }

    // Everyone in one room on the same terms shares a stay, so the hostel sees
    // one folio per room rather than one per student.
    const { data: openStay } = await supabase
      .from("bookings")
      .select("id, check_in, check_out, guests_count, room_rate, total, pricing_model")
      .eq("hotel_id", allocation.hotel_id)
      .eq("room_id", data.roomId)
      .eq("pricing_model", "per_stay")
      .eq("status", "checked_in")
      .maybeSingle();

    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .insert({
        hotel_id: allocation.hotel_id,
        full_name: student.full_name,
        phone: student.phone,
        email: student.email,
        notes: request ? `Student — ${request.title}` : "Student",
      })
      .select("id")
      .single();
    if (guestError || !guest) throw new Error(guestError?.message ?? "Could not create the guest");

    let bookingId: string;

    if (openStay && openStay.check_out === checkOut) {
      bookingId = openStay.id;
      await supabase
        .from("bookings")
        .update({
          guests_count: Number(openStay.guests_count) + 1,
          total: round2(Number(openStay.total) + price),
        })
        .eq("id", openStay.id);
    } else {
      const { data: hotel } = await supabase
        .from("hotels")
        .select("tax_percent, service_charge_percent")
        .eq("id", allocation.hotel_id)
        .single();
      const tax = round2(price * (Number(hotel?.tax_percent ?? 0) / 100));
      const serviceCharge = round2(price * (Number(hotel?.service_charge_percent ?? 0) / 100));

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          hotel_id: allocation.hotel_id,
          guest_id: guest.id,
          room_id: data.roomId,
          room_type_id: room.room_type_id,
          check_in: checkIn,
          check_out: checkOut,
          guests_count: 1,
          room_rate: price,
          pricing_model: "per_stay",
          tax_amount: tax,
          service_charge: serviceCharge,
          services_total: 0,
          total: round2(price + tax + serviceCharge),
          amount_paid: 0,
          status: "checked_in",
          source: "staff",
          notes: request
            ? `${request.title}${request.semester ? ` · ${request.semester}` : ""}`
            : "",
          reference: generateRef("RES"),
          checked_in_at: new Date().toISOString(),
          created_by: userId,
        })
        .select("id")
        .single();
      if (bookingError || !booking)
        throw new Error(bookingError?.message ?? "Could not create the stay");
      bookingId = booking.id;
    }

    await supabase.from("folio_items").insert({
      hotel_id: allocation.hotel_id,
      booking_id: bookingId,
      category: "accommodation",
      description: `Accommodation: ${student.full_name}${request ? ` · ${request.title}` : ""}`,
      quantity: 1,
      unit_price: price,
      amount: price,
      created_by: userId,
    });

    const { data: occupancy, error: occupancyError } = await supabase
      .from("occupancies")
      .insert({
        hotel_id: allocation.hotel_id,
        booking_id: bookingId,
        guest_id: guest.id,
        room_id: data.roomId,
        bed_number: data.bedNumber ?? allocation.bed_number ?? null,
        price,
        status: "checked_in",
        checked_in_at: new Date().toISOString(),
        created_by: userId,
      })
      .select("id")
      .single();
    if (occupancyError || !occupancy)
      throw new Error(occupancyError?.message ?? "Could not record the occupancy");

    await supabase
      .from("student_allocations")
      .update({
        status: "checked_in",
        room_id: data.roomId,
        bed_number: data.bedNumber ?? allocation.bed_number ?? null,
        occupancy_id: occupancy.id,
        price,
      })
      .eq("id", data.allocationId);

    await supabase.from("rooms").update({ status: "occupied" }).eq("id", data.roomId);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: allocation.hotel_id,
      user_id: userId,
      action: "student_allocation.checked_in",
      resource: "student_allocation",
      resource_id: allocation.id,
      new_value: { booking_id: bookingId, occupancy_id: occupancy.id, room_id: data.roomId },
    });

    return { bookingId, occupancyId: occupancy.id };
  });

/* ------------------------------------------------------------------ */
/* School side: reads for the workspace                                */
/* ------------------------------------------------------------------ */

const controllerScopeSchema = z.object({ controllerId: z.string().uuid() });

export const listSchoolRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => controllerScopeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertControllerAccess(supabase, data.controllerId);

    const { data: requests } = await supabase
      .from("accommodation_requests")
      .select("*")
      .eq("controller_id", data.controllerId)
      .order("created_at", { ascending: false })
      .limit(200);

    const ids = (requests ?? []).map((r) => r.id);
    const { data: offers } = ids.length
      ? await supabase.from("allocation_offers").select("*").in("request_id", ids)
      : { data: [] };
    const { data: allocations } = ids.length
      ? await supabase
          .from("student_allocations")
          .select("id, request_id, status")
          .in("request_id", ids)
      : { data: [] };

    return (requests ?? []).map((r) => ({
      ...r,
      offers: (offers ?? []).filter((o) => o.request_id === r.id),
      assignedCount: (allocations ?? []).filter(
        (a) => a.request_id === r.id && a.status !== "cancelled",
      ).length,
    }));
  });

export const getSchoolRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => requestActionSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: request } = await supabase
      .from("accommodation_requests")
      .select("*")
      .eq("id", data.requestId)
      .single();
    if (!request) throw new Error("Request not found");
    await assertControllerAccess(supabase, request.controller_id);

    const { data: offers } = await supabase
      .from("allocation_offers")
      .select("*")
      .eq("request_id", data.requestId)
      .order("price_per_student", { ascending: true });

    // Hotel names come through the service-role client: a school can only read
    // hotels it is already affiliated with, and it may be weighing up a new one.
    const hotelIds = Array.from(new Set((offers ?? []).map((o) => o.hotel_id)));
    const { data: hotels } = hotelIds.length
      ? await supabaseAdmin
          .from("hotels")
          .select("id, name, city, hotel_type, phone, email")
          .in("id", hotelIds)
      : { data: [] };
    const hotelById = new Map((hotels ?? []).map((h) => [h.id, h]));

    const { data: allocations } = await supabase
      .from("student_allocations")
      .select("*, students(full_name, student_ref, gender)")
      .eq("request_id", data.requestId)
      .not("status", "eq", "cancelled");

    return {
      request,
      offers: (offers ?? []).map((o) => ({ ...o, hotel: hotelById.get(o.hotel_id) ?? null })),
      allocations: allocations ?? [],
    };
  });

export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => controllerScopeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertControllerAccess(supabase, data.controllerId);

    const { data: students } = await supabase
      .from("students")
      .select("*")
      .eq("controller_id", data.controllerId)
      .order("full_name", { ascending: true })
      .limit(1000);

    return students ?? [];
  });

/** Hostels this school works with, and how many of its students are with each. */
export const listSchoolHostels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => controllerScopeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertControllerAccess(supabase, data.controllerId);

    const { data: affiliations } = await supabase
      .from("hotel_controller_affiliations")
      .select("*")
      .eq("controller_id", data.controllerId);

    const hotelIds = (affiliations ?? []).map((a) => a.hotel_id);
    const { data: hotels } = hotelIds.length
      ? await supabaseAdmin
          .from("hotels")
          .select("id, name, city, address, phone, email, hotel_type")
          .in("id", hotelIds)
      : { data: [] };
    const hotelById = new Map((hotels ?? []).map((h) => [h.id, h]));

    const { data: allocations } = await supabase
      .from("student_allocations")
      .select("hotel_id, status")
      .eq("controller_id", data.controllerId)
      .not("status", "eq", "cancelled");

    return (affiliations ?? []).map((a) => ({
      ...a,
      hotel: hotelById.get(a.hotel_id) ?? null,
      studentsPlaced: (allocations ?? []).filter((s) => s.hotel_id === a.hotel_id).length,
      studentsCheckedIn: (allocations ?? []).filter(
        (s) => s.hotel_id === a.hotel_id && s.status === "checked_in",
      ).length,
    }));
  });

export const getSchoolOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => controllerScopeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertControllerAccess(supabase, data.controllerId);

    const [requests, students, allocations, affiliations] = await Promise.all([
      supabase
        .from("accommodation_requests")
        .select("id, title, status, semester, students_count, created_at")
        .eq("controller_id", data.controllerId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("controller_id", data.controllerId),
      supabase
        .from("student_allocations")
        .select("id, status")
        .eq("controller_id", data.controllerId)
        .not("status", "eq", "cancelled"),
      supabase
        .from("hotel_controller_affiliations")
        .select("id", { count: "exact", head: true })
        .eq("controller_id", data.controllerId),
    ]);

    const rows = allocations.data ?? [];
    return {
      recentRequests: requests.data ?? [],
      studentCount: students.count ?? 0,
      hostelCount: affiliations.count ?? 0,
      placedCount: rows.length,
      checkedInCount: rows.filter((r) => r.status === "checked_in").length,
    };
  });
