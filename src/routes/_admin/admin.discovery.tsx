import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getDiscoveryStats, setHotelDiscovery } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { money, titleCase } from "@/lib/format";
import { Globe, Star, CalendarCheck, Wallet } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/discovery")({
  head: () => ({
    meta: [
      { title: "Discovery site — Custard Hotels Admin" },
      { name: "description", content: "Curate the public hotel discovery site: listings, featured stays and online booking." },
      { property: "og:title", content: "Discovery site — Custard Hotels Admin" },
      { property: "og:description", content: "Curate the public hotel discovery site: listings, featured stays and online booking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDiscoveryPage,
});

function AdminDiscoveryPage() {
  const fetchStats = useServerFn(getDiscoveryStats);
  const update = useServerFn(setHotelDiscovery);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin", "discovery"], queryFn: () => fetchStats({}) });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const toggle = async (hotelId: string, patch: { isFeatured?: boolean; isPublicListed?: boolean; acceptOnlineBookings?: boolean }) => {
    setBusyId(hotelId);
    try {
      await update({ data: { hotelId, ...patch } });
      await refetch();
      toast.success("Discovery updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const hotels = (data?.hotels ?? []).filter((h) => !search || `${h.name} ${h.city ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminShell title="Discovery site">
      <PageHeader title="Discovery site" description="Control which hotels appear on the public site and which are featured." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Listed publicly" value={data?.listedCount ?? 0} icon={Globe} tone="primary" />
        <StatCard label="Featured" value={data?.featuredCount ?? 0} icon={Star} tone="accent" />
        <StatCard label="Online bookings" value={data?.onlineBookings ?? 0} icon={CalendarCheck} tone="success" />
        <StatCard label="Online booking value" value={money(data?.onlineRevenue ?? 0, "GHS")} icon={Wallet} tone="default" />
      </div>

      <Card className="mt-6">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="kinetic-label text-xs text-foreground">Hotel listings</h3>
            <input
              className="border-[2px] border-ink bg-transparent px-3 py-2 text-sm"
              placeholder="Search hotels"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search hotels"
            />
          </div>

          {isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading hotels…</p>
          ) : hotels.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No hotels match that search.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {hotels.map((hotel) => (
                <div key={hotel.id} className="flex flex-col gap-3 border-[2px] border-ink p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{hotel.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {hotel.city ?? "—"} · {titleCase(String(hotel.status))} · /{hotel.slug}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-5">
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      Listed
                      <Switch
                        disabled={busyId === hotel.id}
                        checked={hotel.is_public_listed}
                        onCheckedChange={(checked) => toggle(hotel.id, { isPublicListed: checked })}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      Featured
                      <Switch
                        disabled={busyId === hotel.id}
                        checked={hotel.is_featured}
                        onCheckedChange={(checked) => toggle(hotel.id, { isFeatured: checked })}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                      Online booking
                      <Switch
                        disabled={busyId === hotel.id}
                        checked={hotel.accept_online_bookings}
                        onCheckedChange={(checked) => toggle(hotel.id, { acceptOnlineBookings: checked })}
                      />
                    </label>
                    <Button asChild size="sm" variant="secondary">
                      <a href={`/hotels/${hotel.slug}`} target="_blank" rel="noreferrer">
                        View page
                      </a>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
