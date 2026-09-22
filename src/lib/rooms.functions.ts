import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

async function assertHotelAccess(supabase: unknown, hotelId: string) {
  const { data } = await (supabase as RpcClient).rpc("has_hotel_access", { _hotel_id: hotelId });
  if (data !== true) throw new Error("You do not have access to this hotel");
}

const createRoomTypeSchema = z.object({
  hotelId: z.string().uuid(),
  name: z.string().min(2).max(80),
  basePrice: z.number().nonnegative(),
  maxGuests: z.number().int().min(1).max(40).default(2),
  bedCount: z.number().int().min(1).max(40).default(1),
  bedType: z.string().max(40).default("Double"),
  pricingModel: z.enum(["per_night", "per_stay"]).default("per_night"),
  perStayPrice: z.number().nonnegative().optional(),
  description: z.string().max(1000).default(""),
});

export const createRoomType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createRoomTypeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelAccess(supabase, data.hotelId);

    if (data.pricingModel === "per_stay" && !(data.perStayPrice && data.perStayPrice > 0))
      throw new Error("Set a per-stay price for semester stays");

    const { data: created, error } = await supabase
      .from("room_types")
      .insert({
        hotel_id: data.hotelId,
        name: data.name,
        base_price: data.basePrice,
        max_guests: data.maxGuests,
        bed_count: data.bedCount,
        bed_type: data.bedType,
        pricing_model: data.pricingModel,
        per_stay_price: data.pricingModel === "per_stay" ? (data.perStayPrice ?? null) : null,
        description: data.description,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create room type");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "room_type.created",
      resource: "room_type",
      resource_id: created.id,
      new_value: {
        name: created.name,
        base_price: data.basePrice,
        pricing_model: data.pricingModel,
        per_stay_price: data.perStayPrice,
      },
    });

    return { id: created.id, name: created.name };
  });

const updateRoomTypeSchema = z.object({
  roomTypeId: z.string().uuid(),
  name: z.string().min(2).max(80).optional(),
  basePrice: z.number().nonnegative().optional(),
  maxGuests: z.number().int().min(1).max(40).optional(),
  bedCount: z.number().int().min(1).max(40).optional(),
  bedType: z.string().max(40).optional(),
  pricingModel: z.enum(["per_night", "per_stay"]).optional(),
  perStayPrice: z.number().nonnegative().nullable().optional(),
  description: z.string().max(1000).optional(),
});

export const updateRoomType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateRoomTypeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roomType } = await supabase
      .from("room_types")
      .select("id, hotel_id, pricing_model")
      .eq("id", data.roomTypeId)
      .single();
    if (!roomType) throw new Error("Room type not found");
    await assertHotelAccess(supabase, roomType.hotel_id);

    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update["name"] = data.name;
    if (data.basePrice !== undefined) update["base_price"] = data.basePrice;
    if (data.maxGuests !== undefined) update["max_guests"] = data.maxGuests;
    if (data.bedCount !== undefined) update["bed_count"] = data.bedCount;
    if (data.bedType !== undefined) update["bed_type"] = data.bedType;
    if (data.pricingModel !== undefined) {
      update["pricing_model"] = data.pricingModel;
      if (data.pricingModel === "per_night") update["per_stay_price"] = null;
    }
    if (data.perStayPrice !== undefined && data.pricingModel !== "per_night")
      update["per_stay_price"] = data.perStayPrice;
    if (data.description !== undefined) update["description"] = data.description;
    if (Object.keys(update).length === 0) return { ok: true };

    if (update["pricing_model"] === "per_stay" && !(update["per_stay_price"] ?? data.perStayPrice))
      throw new Error("Set a per-stay price for semester stays");

    const { error } = await supabase
      .from("room_types")
      .update(update as never)
      .eq("id", data.roomTypeId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: roomType.hotel_id,
      user_id: userId,
      action: "room_type.updated",
      resource: "room_type",
      resource_id: data.roomTypeId,
      new_value: update as Record<string, never>,
    });

    return { ok: true };
  });

const createRoomSchema = z.object({
  hotelId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  roomNumber: z.string().min(1).max(20),
  floor: z.string().max(20).default(""),
  status: z
    .enum(["available", "cleaning", "dirty", "maintenance", "out_of_service"])
    .default("available"),
  notes: z.string().max(500).default(""),
});

export const createRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createRoomSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelAccess(supabase, data.hotelId);

    const { data: roomType } = await supabase
      .from("room_types")
      .select("id")
      .eq("id", data.roomTypeId)
      .eq("hotel_id", data.hotelId)
      .maybeSingle();
    if (!roomType) throw new Error("Room type does not belong to this hotel");

    const { data: duplicate } = await supabase
      .from("rooms")
      .select("id")
      .eq("hotel_id", data.hotelId)
      .eq("room_number", data.roomNumber)
      .maybeSingle();
    if (duplicate) throw new Error(`Room ${data.roomNumber} already exists`);

    const { data: created, error } = await supabase
      .from("rooms")
      .insert({
        hotel_id: data.hotelId,
        room_type_id: data.roomTypeId,
        room_number: data.roomNumber,
        floor: data.floor,
        status: data.status,
        notes: data.notes,
      })
      .select("id, room_number")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create room");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      hotel_id: data.hotelId,
      user_id: userId,
      action: "room.created",
      resource: "room",
      resource_id: created.id,
      new_value: { room_number: created.room_number },
    });

    return { id: created.id, roomNumber: created.room_number };
  });

const updateRoomStatusSchema = z.object({
  roomId: z.string().uuid(),
  status: z.enum([
    "available",
    "reserved",
    "occupied",
    "cleaning",
    "dirty",
    "inspected",
    "maintenance",
    "out_of_service",
  ]),
});

export const updateRoomStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateRoomStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: room } = await supabase
      .from("rooms")
      .select("id, hotel_id")
      .eq("id", data.roomId)
      .single();
    if (!room) throw new Error("Room not found");
    await assertHotelAccess(supabase, room.hotel_id);

    const { error } = await supabase
      .from("rooms")
      .update({ status: data.status })
      .eq("id", data.roomId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
