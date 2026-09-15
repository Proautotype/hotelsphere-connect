import { supabase } from "@/integrations/supabase/client";

export const HOTEL_MEDIA_BUCKET = "hotel-media";

/** Turn stored file paths into links the browser can display. */
export async function signHotelMedia(paths: string[], expiresInSeconds = 60 * 60) {
  const clean = paths.filter(Boolean);
  if (clean.length === 0) return [] as { path: string; url: string }[];
  const { data, error } = await supabase.storage
    .from(HOTEL_MEDIA_BUCKET)
    .createSignedUrls(clean, expiresInSeconds);
  if (error) throw new Error(error.message);
  return clean.map((path, i) => ({ path, url: data?.[i]?.signedUrl ?? "" }));
}

/** Upload one image for a hotel and return its stored path. */
export async function uploadHotelPhoto(hotelId: string, file: File) {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
  const path = `${hotelId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(HOTEL_MEDIA_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeHotelPhoto(path: string) {
  await supabase.storage.from(HOTEL_MEDIA_BUCKET).remove([path]);
}

/** Accepted browser-friendly tour video formats. */
const TOUR_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime", "video/x-m4v"]);

/** Client-side cap matches the storage bucket's object size limit. */
export const MAX_TOUR_VIDEO_BYTES = 50 * 1024 * 1024;

/** Upload one tour video for a hotel and return its stored path. */
export async function uploadHotelTourVideo(hotelId: string, file: File) {
  const type = (file.type || "").toLowerCase();
  if (!TOUR_VIDEO_TYPES.has(type)) {
    throw new Error("Please choose an MP4 or WebM tour video.");
  }
  if (file.size > MAX_TOUR_VIDEO_BYTES) {
    throw new Error("Tour video must be 50MB or smaller.");
  }
  const ext =
    (file.name.split(".").pop() ?? "mp4")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5) || "mp4";
  const path = `${hotelId}/tour/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(HOTEL_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "video/mp4",
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function removeHotelTourVideo(path: string) {
  await supabase.storage.from(HOTEL_MEDIA_BUCKET).remove([path]);
}

/** Accepts any common YouTube link shape and returns the embed URL. */
export function youtubeEmbedUrl(url: string): string | null {
  const match = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i.exec(
    url,
  );
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : null;
}
