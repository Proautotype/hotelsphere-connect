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

/** Accepts any common YouTube link shape and returns the embed URL. */
export function youtubeEmbedUrl(url: string): string | null {
  const match =
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i.exec(url);
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}` : null;
}
