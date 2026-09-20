import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  CHANNEL_PROVIDERS,
  listChannels,
  saveChannel,
  syncChannel,
  setChannelPaused,
  deleteChannel,
} from "@/lib/channels.functions";
import { dateTime, titleCase } from "@/lib/format";
import { Copy, Link2, Pause, Play, Plus, RefreshCw, Share2, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/channels")({
  head: () => ({
    meta: [
      { title: "Channels — Custard Hotels" },
      {
        name: "description",
        content:
          "Link Booking.com, Expedia, Airbnb and other travel sites so reservations and free dates stay in step.",
      },
      { property: "og:title", content: "Channels — Custard Hotels" },
      {
        property: "og:description",
        content: "Keep Booking.com, Expedia and Airbnb in step with your rooms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChannelsPage,
});

interface DraftState {
  id?: string;
  provider: string;
  label: string;
  mode: "ical" | "api";
  roomTypeId: string;
  importUrl: string;
  propertyId: string;
  accountRef: string;
}

const emptyDraft: DraftState = {
  provider: "booking_com",
  label: "",
  mode: "ical",
  roomTypeId: "",
  importUrl: "",
  propertyId: "",
  accountRef: "",
};

function ChannelsPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const queryClient = useQueryClient();

  const listFn = useServerFn(listChannels);
  const saveFn = useServerFn(saveChannel);
  const syncFn = useServerFn(syncChannel);
  const pauseFn = useServerFn(setChannelPaused);
  const removeFn = useServerFn(deleteChannel);

  const { data } = useQuery({
    queryKey: ["channels", hotelId],
    queryFn: () => listFn({ data: { hotelId } }),
    enabled: Boolean(hotelId),
  });

  const connections = data?.connections ?? [];
  const roomTypes = data?.roomTypes ?? [];
  const logs = data?.logs ?? [];

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["channels"] });
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const exportUrl = (token: string) =>
    typeof window === "undefined" ? "" : `${window.location.origin}/api/public/ical/${token}.ics`;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — select the link and copy it by hand.");
    }
  };

  const save = async () => {
    if (!draft || busy) return;
    setBusy("save");
    try {
      await saveFn({
        data: {
          id: draft.id,
          hotelId,
          provider: draft.provider as "booking_com",
          label: draft.label,
          mode: draft.mode,
          roomTypeId: draft.roomTypeId,
          importUrl: draft.importUrl,
          autoSync: true,
          propertyId: draft.propertyId,
          accountRef: draft.accountRef,
        },
      });
      toast.success("Channel saved");
      setDraft(null);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this channel");
    } finally {
      setBusy(null);
    }
  };

  const run = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      const result = await syncFn({ data: { id } });
      if (result.ok) toast.success(`Sync finished — ${result.message}`);
      else toast.error(result.message);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardShell title="Channels">
      <PageHeader
        title="Channels"
        description="Keep Booking.com, Expedia, Airbnb and your own calendar in step, so the same room is never sold twice."
        actions={
          <Button type="button" onClick={() => setDraft({ ...emptyDraft })}>
            <Plus className="mr-1 size-4" /> Add channel
          </Button>
        }
      />

      <div className="mt-6 space-y-4">
        {connections.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="No travel sites linked yet"
            description="Paste the calendar link from Booking.com, Expedia or Airbnb and their reservations come in automatically. Share your own link back so they see your booked dates."
            action={
              <Button type="button" onClick={() => setDraft({ ...emptyDraft })}>
                Add your first channel
              </Button>
            }
          />
        ) : (
          connections.map((c) => {
            const providerLabel =
              CHANNEL_PROVIDERS.find((p) => p.value === c.provider)?.label ?? titleCase(c.provider);
            const roomTypeName = roomTypes.find((r) => r.id === c.room_type_id)?.name;
            const paused = c.status === "paused";
            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {providerLabel}
                      {c.label ? ` · ${c.label}` : ""}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.mode === "ical" ? "Calendar link" : "Partner account"} ·{" "}
                      {roomTypeName ?? "All rooms"} · {titleCase(c.status)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void run(c.id)}
                    >
                      <RefreshCw
                        className={busy === c.id ? "mr-1 size-4 animate-spin" : "mr-1 size-4"}
                      />
                      {busy === c.id ? "Syncing…" : "Sync now"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(c.id);
                        try {
                          await pauseFn({ data: { id: c.id, paused: !paused } });
                          refresh();
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          id: c.id,
                          provider: c.provider,
                          label: c.label,
                          mode: c.mode,
                          roomTypeId: c.room_type_id ?? "",
                          importUrl: c.import_url ?? "",
                          propertyId:
                            (c.api_config as { property_id?: string } | null)?.property_id ?? "",
                          accountRef:
                            (c.api_config as { account_ref?: string } | null)?.account_ref ?? "",
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(c.id);
                        try {
                          await removeFn({ data: { id: c.id } });
                          toast.success("Channel removed");
                          refresh();
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="kinetic-label text-[10px]">Your link to give them</p>
                    <div className="mt-1 flex gap-2">
                      <Input readOnly value={exportUrl(c.export_token)} className="text-xs" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void copy(exportUrl(c.export_token))}
                      >
                        <Copy className="size-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Paste this into {providerLabel} so they stop selling dates you have already
                      filled.
                    </p>
                  </div>
                  {c.last_sync_at ? (
                    <p className="text-xs text-muted-foreground">
                      Last sync {dateTime(c.last_sync_at)} —{" "}
                      <span className={c.last_sync_ok ? "" : "font-semibold text-destructive"}>
                        {c.last_sync_message ?? ""}
                      </span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not synced yet.</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        {logs.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{dateTime(l.created_at)}</span>
                  <span className={l.ok ? "" : "font-semibold text-destructive"}>{l.message}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit channel" : "Add a channel"}</DialogTitle>
            <DialogDescription>
              Calendar links work right away. A partner account gives full two-way sync once
              Booking.com or Expedia approves you.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-3">
              <div>
                <Label>Travel site</Label>
                <Select
                  value={draft.provider}
                  onValueChange={(value) => setDraft({ ...draft, provider: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>How to connect</Label>
                <Select
                  value={draft.mode}
                  onValueChange={(value) =>
                    setDraft({ ...draft, mode: value as DraftState["mode"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ical">Calendar link (works today)</SelectItem>
                    <SelectItem value="api">Partner account (needs approval)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ch-room-type">Room category this covers</Label>
                <Select
                  value={draft.roomTypeId}
                  onValueChange={(value) => setDraft({ ...draft, roomTypeId: value })}
                >
                  <SelectTrigger id="ch-room-type">
                    <SelectValue placeholder="Choose a room category" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {draft.mode === "ical" ? (
                <div>
                  <Label htmlFor="ch-url">Their calendar link</Label>
                  <Input
                    id="ch-url"
                    value={draft.importUrl}
                    onChange={(e) => setDraft({ ...draft, importUrl: e.target.value })}
                    placeholder="https://admin.booking.com/…/calendar.ics"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Find it in the travel site's calendar settings, usually called "export" or
                    "sync calendar".
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="ch-prop">Property ID on that site</Label>
                    <Input
                      id="ch-prop"
                      value={draft.propertyId}
                      onChange={(e) => setDraft({ ...draft, propertyId: e.target.value })}
                      placeholder="e.g. 1234567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ch-acct">Partner account reference</Label>
                    <Input
                      id="ch-acct"
                      value={draft.accountRef}
                      onChange={(e) => setDraft({ ...draft, accountRef: e.target.value })}
                      placeholder="Account name or agreement number"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      We hold this ready. Two-way sync switches on once the site approves your
                      account and the sign-in details are added.
                    </p>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="ch-label">Nickname (optional)</Label>
                <Input
                  id="ch-label"
                  value={draft.label}
                  onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                  placeholder="Sea view doubles"
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy !== null} onClick={() => void save()}>
              {busy === "save" ? "Saving…" : "Save channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Share2 className="size-4" /> Reservations brought in show up on your booking calendar and
        hold the room straight away.
      </p>
    </DashboardShell>
  );
}
