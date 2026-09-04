import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/housekeeping")({
  head: () => ({
    meta: [
      { title: "Housekeeping — Custard Hotels" },
      { name: "description", content: "Room status board for housekeeping teams." },
      { property: "og:title", content: "Housekeeping — Custard Hotels" },
      { property: "og:description", content: "Room status board for housekeeping teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["rooms", "housekeeping"],
      queryFn: async () => fetchRooms(),
    });
  },
  component: HousekeepingPage,
});

async function fetchRooms() {
  const { data, error } = await supabase.from("rooms").select("*, room_types(name)").order("room_number", { ascending: true }).limit(300);
  if (error) throw new Error(error.message);
  return data ?? [];
}

const WORKFLOW: Record<string, string> = {
  dirty: "cleaning",
  cleaning: "inspected",
  inspected: "available",
  available: "maintenance",
  maintenance: "available",
  occupied: "dirty",
  reserved: "dirty",
  out_of_service: "maintenance",
};

function HousekeepingPage() {
  const { data: rooms, refetch } = useSuspenseQuery({ queryKey: ["rooms", "housekeeping"], queryFn: fetchRooms });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("rooms").update({ status: status as "dirty" }).eq("id", id);
    if (error) return;
    await refetch();
  };

  type RoomRow = { id: string; room_number: string; status: string; room_types: unknown };
  const groups: Record<string, RoomRow[]> = { dirty: [], cleaning: [], inspected: [], available: [], occupied: [], maintenance: [], out_of_service: [], reserved: [] };
  (rooms as Array<{ id: string; room_number: string; status: string; room_types: unknown }>).forEach((r) => {
    const key = (r.status as keyof typeof groups) ?? "available";
    (groups[key] ??= []).push(r);
  });

  return (
    <DashboardShell title="Housekeeping">
      <PageHeader title="Housekeeping" description="Move rooms through the status pipeline." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["dirty", "cleaning", "inspected", "available", "maintenance", "occupied"].map((status) => (
          <Card key={status}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-lg font-semibold text-foreground">{groups[status]?.length ?? 0}</span>
              </div>
              <div className="space-y-2">
                {((groups[status] ?? []) as Array<{ id: string; room_number: string; room_types: unknown }>).map((room) => {
                  const rt = room.room_types as unknown as { name: string } | null;
                  const next = WORKFLOW[status];
                  return (
                    <div key={room.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                      <div>
                        <p className="text-sm font-medium text-foreground">{room.room_number}</p>
                        <p className="text-xs text-muted-foreground">{rt?.name}</p>
                      </div>
                      {next && (
                        <Button size="sm" variant="ghost" onClick={() => updateStatus(room.id, next)}>
                          <Sparkles className="mr-1 size-3" /> {next.replace("_", " ")}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
