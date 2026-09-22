import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };

async function assertHotelAccess(supabase: unknown, hotelId: string) {
  const { data } = await (supabase as RpcClient).rpc("has_hotel_access", { _hotel_id: hotelId });
  if (data !== true) throw new Error("You do not have access to this hotel");
}

export const CHANNEL_PROVIDERS = [
  { value: "booking_com", label: "Booking.com" },
  { value: "expedia", label: "Expedia" },
  { value: "airbnb", label: "Airbnb" },
  { value: "agoda", label: "Agoda" },
  { value: "vrbo", label: "Vrbo" },
  { value: "other", label: "Other travel site" },
] as const;

export type ChannelProvider = (typeof CHANNEL_PROVIDERS)[number]["value"];

/* ------------------------------------------------------------------ */
/* iCalendar helpers                                                   */
/* ------------------------------------------------------------------ */

export interface IcalEvent {
  uid: string;
  summary: string;
  start: string; // yyyy-mm-dd
  end: string; // yyyy-mm-dd (exclusive, like a check-out date)
}

function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function icalDate(value: string): string | null {
  const compact = value.trim().replace(/[-:]/g, "");
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(compact);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function parseIcal(raw: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  let current: Partial<IcalEvent> | null = null;
  for (const line of unfold(raw)) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current?.uid && current.start && current.end) {
        events.push({
          uid: current.uid,
          summary: current.summary ?? "Reservation",
          start: current.start,
          end: current.end,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const sep = trimmed.indexOf(":");
    if (sep < 0) continue;
    const key = trimmed.slice(0, sep).toUpperCase();
    const value = trimmed.slice(sep + 1);
    if (key === "UID") current.uid = value;
    else if (key.startsWith("SUMMARY")) current.summary = value;
    else if (key.startsWith("DTSTART")) {
      const parsed = icalDate(value);
      if (parsed) current.start = parsed;
    } else if (key.startsWith("DTEND")) {
      const parsed = icalDate(value);
      if (parsed) current.end = parsed;
    }
  }
  return events;
}

function icsEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function compact(date: string) {
  return date.replace(/-/g, "");
}

/**
 * A long-term stay has no agreed departure date, but an iCal event must end
 * somewhere. Block a year out from arrival so travel sites keep the room off
 * sale; the feed is rebuilt on every fetch, and the booking drops out of it
 * once the guest is checked out.
 */
function openEndedUntil(checkIn: string) {
  const end = new Date(`${checkIn}T00:00:00Z`);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Reading channels                                                    */
/* ------------------------------------------------------------------ */

export const listChannels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ hotelId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertHotelAccess(supabase, data.hotelId);

    const [{ data: connections }, { data: roomTypes }, { data: logs }] = await Promise.all([
      supabase
        .from("channel_connections")
        .select(
          "id, provider, label, mode, room_type_id, import_url, export_token, status, auto_sync, last_sync_at, last_sync_ok, last_sync_message, imported_count, api_config, created_at",
        )
        .eq("hotel_id", data.hotelId)
        .order("created_at", { ascending: true }),
      supabase
        .from("room_types")
        .select("id, name")
        .eq("hotel_id", data.hotelId)
        .order("name", { ascending: true }),
      supabase
        .from("channel_sync_logs")
        .select("id, connection_id, ok, message, imported, updated, skipped, created_at")
        .eq("hotel_id", data.hotelId)
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    return {
      connections: connections ?? [],
      roomTypes: roomTypes ?? [],
      logs: logs ?? [],
    };
  });

/* ------------------------------------------------------------------ */
/* Saving channels                                                     */
/* ------------------------------------------------------------------ */

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  hotelId: z.string().uuid(),
  provider: z.enum(["booking_com", "expedia", "airbnb", "agoda", "vrbo", "other"]),
  label: z.string().max(80).default(""),
  mode: z.enum(["ical", "api"]),
  roomTypeId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().uuid().optional(),
  ),
  importUrl: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url("Paste the full calendar link, starting with https://").max(600).optional(),
  ),
  autoSync: z.boolean().default(true),
  propertyId: z.string().max(120).default(""),
  accountRef: z.string().max(160).default(""),
});

export const saveChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertHotelAccess(supabase, data.hotelId);

    if (data.mode === "ical" && !data.importUrl && !data.roomTypeId) {
      throw new Error("Choose the room category this calendar covers");
    }
    if (data.mode === "ical" && !data.roomTypeId) {
      throw new Error("Choose the room category this calendar covers");
    }

    const row = {
      hotel_id: data.hotelId,
      provider: data.provider,
      label: data.label,
      mode: data.mode,
      room_type_id: data.roomTypeId ?? null,
      import_url: data.mode === "ical" ? (data.importUrl ?? null) : null,
      auto_sync: data.autoSync,
      status: (data.mode === "api" ? "awaiting_credentials" : "active") as
        "awaiting_credentials" | "active",
      api_config: { property_id: data.propertyId, account_ref: data.accountRef },
      created_by: userId,
    };

    if (data.id) {
      const { error } = await supabase
        .from("channel_connections")
        .update(row as never)
        .eq("id", data.id)
        .eq("hotel_id", data.hotelId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: created, error } = await supabase
      .from("channel_connections")
      .insert(row as never)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not save this channel");
    return { id: created.id };
  });

export const setChannelPaused = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), paused: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("hotel_id, mode")
      .eq("id", data.id)
      .single();
    if (!conn) throw new Error("Channel not found");
    await assertHotelAccess(supabase, conn.hotel_id);

    const status = data.paused ? "paused" : conn.mode === "api" ? "awaiting_credentials" : "active";
    const { error } = await supabase
      .from("channel_connections")
      .update({ status } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: conn } = await supabase
      .from("channel_connections")
      .select("hotel_id")
      .eq("id", data.id)
      .single();
    if (!conn) throw new Error("Channel not found");
    await assertHotelAccess(supabase, conn.hotel_id);

    const { error } = await supabase.from("channel_connections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Importing reservations                                              */
/* ------------------------------------------------------------------ */

const round2 = (value: number) => Math.round(value * 100) / 100;

function nightsBetween(from: string, to: string) {
  return Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

function guestNameFrom(summary: string) {
  const cleaned = summary
    .replace(/\((.*?)\)/g, " ")
    .replace(/\b(CLOSED|Not available|Unavailable|Reserved|Blocked)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned.slice(0, 80) : "Travel site guest";
}

export const syncChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: conn } = await supabase
      .from("channel_connections")
      .select("id, hotel_id, provider, label, mode, room_type_id, import_url, status")
      .eq("id", data.id)
      .single();
    if (!conn) throw new Error("Channel not found");
    await assertHotelAccess(supabase, conn.hotel_id);

    const finish = async (
      ok: boolean,
      message: string,
      counts = { imported: 0, updated: 0, skipped: 0 },
    ) => {
      await supabase
        .from("channel_connections")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_ok: ok,
          last_sync_message: message,
          status: ok ? "active" : conn.mode === "api" ? "awaiting_credentials" : "error",
        } as never)
        .eq("id", conn.id);
      await supabase.from("channel_sync_logs").insert({
        hotel_id: conn.hotel_id,
        connection_id: conn.id,
        direction: "import",
        ok,
        message,
        imported: counts.imported,
        updated: counts.updated,
        skipped: counts.skipped,
      });
      return { ok, message, ...counts };
    };

    if (conn.mode === "api") {
      return finish(
        false,
        "This is a partner-account connection. Once your Booking.com or Expedia partner account is approved and the credentials are saved, two-way sync starts automatically. Calendar-link sync works today.",
      );
    }
    if (!conn.import_url) return finish(false, "Add the calendar link from the travel site first.");
    if (conn.status === "paused") return finish(false, "This channel is paused.");
    if (!conn.room_type_id) return finish(false, "Choose the room category this calendar covers.");

    let raw = "";
    try {
      const response = await fetch(conn.import_url, {
        headers: { Accept: "text/calendar, text/plain, */*" },
      });
      if (!response.ok) {
        return finish(
          false,
          `The travel site refused the calendar link (error ${response.status}).`,
        );
      }
      raw = await response.text();
    } catch {
      return finish(false, "Could not reach the calendar link. Check that it is still valid.");
    }

    const events = parseIcal(raw);
    if (events.length === 0) return finish(true, "No reservations found on that calendar yet.");

    const { data: hotel } = await supabase
      .from("hotels")
      .select("tax_percent, service_charge_percent")
      .eq("id", conn.hotel_id)
      .single();
    const { data: roomType } = await supabase
      .from("room_types")
      .select("id, name, base_price")
      .eq("id", conn.room_type_id)
      .single();
    const { data: rooms } = await supabase
      .from("rooms")
      .select("id, room_number, status")
      .eq("hotel_id", conn.hotel_id)
      .eq("room_type_id", conn.room_type_id);

    const { data: existingMap } = await supabase
      .from("channel_bookings")
      .select("id, external_uid, booking_id, check_in, check_out")
      .eq("connection_id", conn.id);
    const byUid = new Map((existingMap ?? []).map((m) => [m.external_uid, m]));

    const label = conn.label || conn.provider.replace(/_/g, " ");
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const event of events.slice(0, 200)) {
      const known = byUid.get(event.uid);
      if (known) {
        if (known.check_in !== event.start || known.check_out !== event.end) {
          if (known.booking_id) {
            await supabase
              .from("bookings")
              .update({ check_in: event.start, check_out: event.end } as never)
              .eq("id", known.booking_id);
          }
          await supabase
            .from("channel_bookings")
            .update({
              check_in: event.start,
              check_out: event.end,
              summary: event.summary,
              last_seen_at: new Date().toISOString(),
            } as never)
            .eq("id", known.id);
          updated += 1;
        } else {
          await supabase
            .from("channel_bookings")
            .update({ last_seen_at: new Date().toISOString() } as never)
            .eq("id", known.id);
        }
        continue;
      }

      // Find a room of this category that is free for the dates.
      const { data: clashes } = await supabase
        .from("bookings")
        .select("room_id")
        .eq("hotel_id", conn.hotel_id)
        .not("status", "in", "(cancelled,no_show,checked_out)")
        .lt("check_in", event.end)
        .gt("check_out", event.start);
      const taken = new Set((clashes ?? []).map((c) => c.room_id).filter(Boolean));
      const freeRoom = (rooms ?? []).find(
        (r) => !taken.has(r.id) && !["maintenance", "out_of_service"].includes(r.status),
      );
      if (!freeRoom) {
        skipped += 1;
        continue;
      }

      const nights = nightsBetween(event.start, event.end);
      const rate = Number(roomType?.base_price ?? 0);
      const subtotal = round2(rate * nights);
      const tax = round2(subtotal * (Number(hotel?.tax_percent ?? 0) / 100));
      const serviceCharge = round2(subtotal * (Number(hotel?.service_charge_percent ?? 0) / 100));
      const total = round2(subtotal + tax + serviceCharge);

      const { data: guest } = await supabase
        .from("guests")
        .insert({
          hotel_id: conn.hotel_id,
          full_name: guestNameFrom(event.summary),
          notes: `Imported from ${label}`,
        })
        .select("id")
        .single();
      if (!guest?.id) {
        skipped += 1;
        continue;
      }

      const reference = `CH-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          hotel_id: conn.hotel_id,
          guest_id: guest.id,
          room_type_id: conn.room_type_id,
          room_id: freeRoom.id,
          check_in: event.start,
          check_out: event.end,
          guests_count: 1,
          room_rate: rate,
          tax_amount: tax,
          service_charge: serviceCharge,
          services_total: 0,
          total,
          amount_paid: 0,
          status: "confirmed",
          source: "external",
          channel_connection_id: conn.id,
          notes: `${label}: ${event.summary}`,
          reference,
          created_by: userId,
        })
        .select("id")
        .single();
      if (bookingError || !booking) {
        skipped += 1;
        continue;
      }

      await supabase.from("channel_bookings").insert({
        hotel_id: conn.hotel_id,
        connection_id: conn.id,
        external_uid: event.uid,
        booking_id: booking.id,
        summary: event.summary,
        check_in: event.start,
        check_out: event.end,
      });
      await supabase.from("rooms").update({ status: "reserved" }).eq("id", freeRoom.id);
      imported += 1;
    }

    if (imported > 0) {
      await supabase.from("notifications").insert({
        user_id: userId,
        hotel_id: conn.hotel_id,
        title: `${imported} booking${imported === 1 ? "" : "s"} from ${label}`,
        body: `New reservations were brought in from ${label}.`,
        type: "channel_sync",
      });
    }

    const parts = [`${imported} new`, `${updated} updated`];
    if (skipped > 0) parts.push(`${skipped} skipped (no free room)`);
    return finish(true, parts.join(", "), { imported, updated, skipped });
  });

/* ------------------------------------------------------------------ */
/* Outgoing calendar (what the travel sites read)                      */
/* ------------------------------------------------------------------ */

export const getChannelIcal = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conn } = await supabaseAdmin
      .from("channel_connections")
      .select("id, hotel_id, room_type_id, label, provider")
      .eq("export_token", data.token)
      .maybeSingle();
    if (!conn) return { found: false as const, ics: "" };

    const { data: hotel } = await supabaseAdmin
      .from("hotels")
      .select("name")
      .eq("id", conn.hotel_id)
      .maybeSingle();

    let query = supabaseAdmin
      .from("bookings")
      .select("id, reference, check_in, check_out, room_type_id, status, channel_connection_id")
      .eq("hotel_id", conn.hotel_id)
      .not("status", "in", "(cancelled,no_show)");
    if (conn.room_type_id) query = query.eq("room_type_id", conn.room_type_id);
    const { data: bookings } = await query;

    const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Custard Hotels//Channel Manager//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${icsEscape(`${hotel?.name ?? "Hotel"} — ${conn.label || conn.provider}`)}`,
    ];
    for (const b of bookings ?? []) {
      // Do not send a channel's own reservations back to it.
      if (b.channel_connection_id === conn.id) continue;
      lines.push(
        "BEGIN:VEVENT",
        `UID:${b.id}@custardhotels`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(b.check_in)}`,
        `DTEND;VALUE=DATE:${compact(b.check_out ?? openEndedUntil(b.check_in))}`,
        `SUMMARY:${icsEscape(`Not available (${b.reference})`)}`,
        "TRANSP:OPAQUE",
        "END:VEVENT",
      );
    }
    lines.push("END:VCALENDAR");

    return { found: true as const, ics: lines.join("\r\n") };
  });
