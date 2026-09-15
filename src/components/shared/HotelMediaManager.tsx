import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateHotelMedia } from "@/lib/hotels.functions";
import {
  removeHotelPhoto,
  removeHotelTourVideo,
  signHotelMedia,
  uploadHotelPhoto,
  uploadHotelTourVideo,
  youtubeEmbedUrl,
} from "@/lib/media";
import { ImagePlus, Trash2, Video, Youtube } from "lucide-react";

interface Props {
  hotelId: string;
  photos: string[];
  videos: string[];
  tourVideoPath: string;
  allowed: boolean;
  onSaved: () => Promise<unknown> | void;
}

export function HotelMediaManager({
  hotelId,
  photos,
  videos,
  tourVideoPath,
  allowed,
  onSaved,
}: Props) {
  const save = useServerFn(updateHotelMedia);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [videoText, setVideoText] = useState(videos.join("\n"));

  const { data: signed = [] } = useQuery({
    queryKey: ["hotel", "media", hotelId, photos.join(",")],
    queryFn: () => signHotelMedia(photos),
    enabled: photos.length > 0,
  });

  // Tour video (background clip on the hotel's public page).
  const tourInput = useRef<HTMLInputElement | null>(null);
  const [tourVideo, setTourVideo] = useState(tourVideoPath);

  useEffect(() => {
    setTourVideo(tourVideoPath);
  }, [tourVideoPath]);

  const { data: signedTour = [] } = useQuery({
    queryKey: ["hotel", "tour-video", hotelId, tourVideo],
    queryFn: () => signHotelMedia([tourVideo], 60 * 60 * 12),
    enabled: Boolean(tourVideo),
  });
  const tourUrl = signedTour.find((s) => s.path === tourVideo)?.url ?? "";

  const pickTourVideo = () => tourInput.current?.click();

  const onTourVideo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadHotelTourVideo(hotelId, file);
      setTourVideo(path);
      await save({ data: { hotelId, tourVideoPath: path } });
      toast.success("Tour video added — it now plays in the background of your hotel page");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (tourInput.current) tourInput.current.value = "";
    }
  };

  const removeTourVideo = async () => {
    if (!tourVideo) return;
    setBusy(true);
    try {
      await save({ data: { hotelId, tourVideoPath: "" } });
      await removeHotelTourVideo(tourVideo);
      setTourVideo("");
      toast.success("Tour video removed");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove video");
    } finally {
      setBusy(false);
    }
  };

  const pickFiles = () => fileInput.current?.click();

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, 10);
    const tooBig = chosen.find((f) => f.size > 15 * 1024 * 1024);
    if (tooBig) {
      toast.error(`${tooBig.name} is larger than 15MB — please use a smaller photo`);
      return;
    }
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of chosen) {
        uploaded.push(await uploadHotelPhoto(hotelId, file));
      }
      await save({ data: { hotelId, photos: [...photos, ...uploaded].slice(0, 30) } });
      toast.success(uploaded.length === 1 ? "Photo added" : `${uploaded.length} photos added`);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removePhoto = async (path: string) => {
    setBusy(true);
    try {
      await save({ data: { hotelId, photos: photos.filter((p) => p !== path) } });
      await removeHotelPhoto(path);
      toast.success("Photo removed");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  };

  const setCover = async (path: string) => {
    setBusy(true);
    try {
      const signedCover = await signHotelMedia([path], 60 * 60 * 24 * 365);
      const url = signedCover[0]?.url;
      if (!url) throw new Error("Could not prepare that photo");
      await save({ data: { hotelId, coverUrl: url } });
      toast.success("Cover photo updated");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set cover photo");
    } finally {
      setBusy(false);
    }
  };

  const saveVideos = async () => {
    const links = videoText
      .split(/\n|,/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10);
    const bad = links.find((l) => !youtubeEmbedUrl(l));
    if (bad) {
      toast.error(`${bad} is not a YouTube link`);
      return;
    }
    setBusy(true);
    try {
      await save({ data: { hotelId, videos: links } });
      toast.success("Videos saved");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save videos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardContent className="space-y-5 p-6">
        <div>
          <h3 className="kinetic-label text-xs text-foreground">Photos &amp; videos</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            These appear on your own hotel page and in search results. Photos up to 15MB each;
            videos are YouTube links.
          </p>
        </div>

        {photos.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((path) => {
              const url = signed.find((s) => s.path === path)?.url ?? "";
              return (
                <div key={path} className="border-[2px] border-ink">
                  {url ? (
                    <img src={url} alt="Hotel photo" className="h-28 w-full object-cover" />
                  ) : (
                    <div className="h-28 w-full bg-sand" />
                  )}
                  {allowed && (
                    <div className="flex items-center justify-between gap-1 border-t-[2px] border-ink p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void setCover(path)}
                      >
                        Make cover
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        aria-label="Remove photo"
                        onClick={() => void removePhoto(path)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="border-[2px] border-ink p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-widest">Tour video</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Plays silently in the background of your hotel page. MP4 or WebM, up to 50&nbsp;MB.
              </p>
            </div>
            {allowed ? (
              tourVideo ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={pickTourVideo}
                  >
                    Replace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    aria-label="Remove tour video"
                    onClick={() => void removeTourVideo()}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={pickTourVideo}
                >
                  <Video className="mr-1 size-4" /> {busy ? "Uploading…" : "Import tour video"}
                </Button>
              )
            ) : null}
          </div>

          {tourUrl && (
            <video
              key={tourVideo}
              src={tourUrl}
              muted
              controls
              playsInline
              className="mt-3 aspect-video w-full border-[2px] border-ink bg-ink"
            />
          )}

          <input
            ref={tourInput}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            hidden
            onChange={(e) => void onTourVideo(e.target.files)}
          />
        </div>

        {allowed ? (
          <>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => void onFiles(e.target.files)}
            />
            <Button type="button" variant="secondary" disabled={busy} onClick={pickFiles}>
              <ImagePlus className="mr-1 size-4" /> {busy ? "Working…" : "Add photos"}
            </Button>

            <div>
              <Label htmlFor="videos">YouTube links (one per line)</Label>
              <Textarea
                id="videos"
                rows={3}
                placeholder="https://www.youtube.com/watch?v=…"
                value={videoText}
                onChange={(e) => setVideoText(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                className="mt-2"
                disabled={busy}
                onClick={() => void saveVideos()}
              >
                <Youtube className="mr-1 size-4" /> Save videos
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">You have read-only access to hotel media.</p>
        )}
      </CardContent>
    </Card>
  );
}
