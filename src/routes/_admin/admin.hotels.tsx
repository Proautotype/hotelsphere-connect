import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { setHotelStatus } from "@/lib/hotels.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_admin/admin/hotels")({
  head: () => ({
    meta: [
      { title: "Hotels — Custard Hotels Admin" },
      { name: "description", content: "Review and manage hotel registrations on Custard Hotels." },
      { property: "og:title", content: "Hotels — Custard Hotels Admin" },
      { property: "og:description", content: "Review and manage hotel registrations on Custard Hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["admin", "hotels"], queryFn: fetchAdminHotels });
  },
  errorComponent: ({ error }) => (
    <AdminShell title="Hotels">
      <div className="mt-6 border-[3px] border-ink bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Could not load hotels</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AdminShell>
  ),
  component: AdminHotelsPage,
});

interface AdminHotelRow {
  id: string;
  name: string;
  status: string;
  city: string | null;
  country: string | null;
  hotel_type: string | null;
  room_count: number | null;
  created_at: string;
  owner_id: string | null;
  owner: { full_name: string; email: string | null } | null;
}

async function fetchAdminHotels(): Promise<AdminHotelRow[]> {
  const { data, error } = await supabase
    .from("hotels")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const hotels = (data ?? []) as unknown as AdminHotelRow[];
  const ownerIds = Array.from(new Set(hotels.map((h) => h.owner_id).filter(Boolean))) as string[];
  let owners: Record<string, { full_name: string; email: string | null }> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
    owners = Object.fromEntries((profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
  }
  return hotels.map((h) => ({ ...h, owner: h.owner_id ? owners[h.owner_id] ?? null : null }));
}

function AdminHotelsPage() {
  const { data: hotels } = useSuspenseQuery({ queryKey: ["admin", "hotels"], queryFn: fetchAdminHotels });


  const mutateStatus = useServerFn(setHotelStatus);

  const changeStatus = async (hotelId: string, status: "active" | "suspended" | "rejected" | "archived") => {
    try {
      await mutateStatus({ data: { hotelId, status } });
      toast.success(`Hotel status changed to ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  return (
    <AdminShell title="Hotels">
      <PageHeader title="Hotel registrations" description="Approve, suspend, or reject hotel registrations." />

      <div className="mt-6 space-y-4">
        {hotels.length === 0 ? (
          <EmptyState icon={Building2} title="No hotels yet" description="Hotels will appear here once owners register." />
        ) : (
          hotels.map((hotel) => {
            const owner = hotel.owner;

            return (
              <Card key={hotel.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-semibold text-foreground">{hotel.name}</h3>
                      <StatusBadge status={hotel.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hotel.city}, {hotel.country} · {hotel.hotel_type} · {hotel.room_count ?? 0} rooms
                    </p>
                    <p className="text-xs text-muted-foreground">Owner: {owner?.full_name ?? "—"} · {owner?.email ?? "—"} · Registered {shortDate(hotel.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hotel.status === "pending" && (
                      <Button size="sm" onClick={() => changeStatus(hotel.id, "active")}>
                        Approve
                      </Button>
                    )}
                    {hotel.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus(hotel.id, "suspended")}>
                        Suspend
                      </Button>
                    )}
                    {hotel.status === "suspended" && (
                      <Button size="sm" variant="outline" onClick={() => changeStatus(hotel.id, "active")}>
                        Reactivate
                      </Button>
                    )}
                    {(hotel.status === "pending" || hotel.status === "suspended") && (
                      <Button size="sm" variant="secondary" onClick={() => changeStatus(hotel.id, "rejected")}>
                        Reject
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AdminShell>
  );
}
