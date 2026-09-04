import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BedDouble } from "lucide-react";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/rooms")({
  head: () => ({
    meta: [
      { title: "Rooms — Custard Hotels" },
      { name: "description", content: "Manage hotel rooms and room statuses." },
      { property: "og:title", content: "Rooms — Custard Hotels" },
      { property: "og:description", content: "Manage hotel rooms and room statuses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ["rooms", "list"],
      queryFn: async () => fetchRooms(),
    });
  },
  component: RoomsPage,
});

async function fetchRooms() {
  const { data, error } = await supabase
    .from("rooms")
    .select("*, room_types(name, base_price, max_guests)")
    .order("room_number", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function RoomsPage() {
  const { activeHotel } = useAuth();
  const { data: rooms } = useSuspenseQuery({ queryKey: ["rooms", "list"], queryFn: fetchRooms });

  type RoomRow = { id: string; room_number: string; status: string; room_types: unknown };
  const statusGroups: Record<string, RoomRow[]> = {
    available: [],
    reserved: [],
    occupied: [],
    cleaning: [],
    dirty: [],
    inspected: [],
    maintenance: [],
    out_of_service: [],
  };
  (rooms as Array<{ id: string; room_number: string; status: string; room_types: unknown }>).forEach((r) => {
    const key = (r.status as keyof typeof statusGroups) ?? "available";
    (statusGroups[key] ??= []).push(r);
  });

  return (
    <DashboardShell title="Rooms">
      <PageHeader title="Rooms" description="Room inventory, status, and assignment." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(statusGroups).map(([status, list]) => (
          <Card key={status}>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <StatusBadge status={status} />
                <span className="text-lg font-semibold text-foreground">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rooms</p>
                ) : (
                  (list as Array<{ id: string; room_number: string; room_types: unknown }>).map((room) => {
                    const rt = room.room_types as unknown as { name: string; base_price: number; max_guests: number } | null;
                    return (
                      <div key={room.id} className="flex items-center justify-between rounded-md border border-border px-2 py-1.5">
                        <div>
                          <p className="text-sm font-medium text-foreground">{room.room_number}</p>
                          <p className="text-xs text-muted-foreground">{rt?.name} · {rt?.max_guests} guests</p>
                        </div>
                        <p className="text-xs font-medium text-foreground">{money(rt?.base_price ?? 0, activeHotel?.currency)}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
