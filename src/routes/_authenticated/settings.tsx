import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { updateHotelSettings } from "@/lib/hotels.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Hotel settings — Custard Hotels" },
      { name: "description", content: "Edit hotel details, taxes, check-in times, and public listing options." },
      { property: "og:title", content: "Hotel settings — Custard Hotels" },
      { property: "og:description", content: "Edit hotel details, taxes, check-in times, and public listing options." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

interface HotelRow {
  id: string;
  name: string;
  description: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string;
  city: string;
  region: string;
  currency: string;
  check_in_time: string;
  check_out_time: string;
  tax_percent: number;
  service_charge_percent: number;
  cancellation_policy: string;
  is_public_listed: boolean;
  accept_online_bookings: boolean;
  show_prices: boolean;
  show_availability: boolean;
  status: string;
}

async function fetchHotel(hotelId: string | null) {
  if (!hotelId) return null;
  const { data, error } = await supabase.from("hotels").select("*").eq("id", hotelId).single();
  if (error) throw new Error(error.message);
  return data as unknown as HotelRow;
}

function SettingsPage() {
  const { activeHotel, profile, can, refresh } = useAuth();
  const hotelId = activeHotel?.id ?? null;
  const { data: hotel, refetch } = useSuspenseQuery({ queryKey: ["hotel", "settings", hotelId], queryFn: () => fetchHotel(hotelId) });
  const save = useServerFn(updateHotelSettings);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<HotelRow | null>(hotel);
  const allowed = can("hotel:settings");

  useEffect(() => {
    setForm(hotel);
  }, [hotel]);

  const set = <K extends keyof HotelRow>(key: K, value: HotelRow[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !hotelId) return;
    setBusy(true);
    try {
      await save({
        data: {
          hotelId,
          name: form.name,
          description: form.description,
          phone: form.phone ?? "",
          address: form.address,
          city: form.city,
          region: form.region,
          checkInTime: form.check_in_time,
          checkOutTime: form.check_out_time,
          taxPercent: Number(form.tax_percent),
          serviceChargePercent: Number(form.service_charge_percent),
          cancellationPolicy: form.cancellation_policy,
          isPublicListed: form.is_public_listed,
          acceptOnlineBookings: form.accept_online_bookings,
          showPrices: form.show_prices,
          showAvailability: form.show_availability,
        },
      });
      toast.success("Settings saved");
      await refetch();
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell title="Settings">
      <PageHeader title="Settings" description="Hotel configuration, pricing rules, and public listing." />

      {!form ? (
        <Card className="mt-6"><CardContent className="p-6 text-sm text-muted-foreground">No hotel selected.</CardContent></Card>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="kinetic-label text-xs text-foreground">Hotel profile</h3>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={form.name} disabled={!allowed} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} value={form.description} disabled={!allowed} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={form.phone ?? ""} disabled={!allowed} onChange={(e) => set("phone", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={form.city} disabled={!allowed} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input id="region" value={form.region} disabled={!allowed} onChange={(e) => set("region", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={form.address} disabled={!allowed} onChange={(e) => set("address", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="kinetic-label text-xs text-foreground">Operations</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="checkIn">Check-in time</Label>
                  <Input id="checkIn" type="time" value={form.check_in_time.slice(0, 5)} disabled={!allowed} onChange={(e) => set("check_in_time", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="checkOut">Check-out time</Label>
                  <Input id="checkOut" type="time" value={form.check_out_time.slice(0, 5)} disabled={!allowed} onChange={(e) => set("check_out_time", e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tax">Tax %</Label>
                  <Input id="tax" type="number" min={0} max={100} step="0.01" value={form.tax_percent} disabled={!allowed} onChange={(e) => set("tax_percent", parseFloat(e.target.value || "0"))} />
                </div>
                <div>
                  <Label htmlFor="svc">Service charge %</Label>
                  <Input id="svc" type="number" min={0} max={100} step="0.01" value={form.service_charge_percent} disabled={!allowed} onChange={(e) => set("service_charge_percent", parseFloat(e.target.value || "0"))} />
                </div>
              </div>
              <div>
                <Label htmlFor="policy">Cancellation policy</Label>
                <Textarea id="policy" rows={3} value={form.cancellation_policy} disabled={!allowed} onChange={(e) => set("cancellation_policy", e.target.value)} />
              </div>
              <p className="text-sm text-muted-foreground">
                Currency {form.currency} · Status {titleCase(form.status)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="kinetic-label text-xs text-foreground">Visibility</h3>
              {(
                [
                  ["is_public_listed", "Listed on public discovery"],
                  ["accept_online_bookings", "Accept online bookings"],
                  ["show_prices", "Show prices publicly"],
                  ["show_availability", "Show availability publicly"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <Label htmlFor={key}>{label}</Label>
                  <Switch id={key} disabled={!allowed} checked={Boolean(form[key])} onCheckedChange={(v) => set(key, v)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <h3 className="kinetic-label text-xs text-foreground">Your account</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium text-foreground">{profile?.full_name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="font-medium text-foreground">{profile?.email}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd className="font-medium text-foreground">{profile?.phone ?? "—"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Access</dt><dd className="font-medium text-foreground">{titleCase(activeHotel?.relation ?? "")}</dd></div>
              </dl>
            </CardContent>
          </Card>

          {allowed ? (
            <div className="lg:col-span-2 flex justify-end">
              <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save settings"}</Button>
            </div>
          ) : (
            <p className="lg:col-span-2 text-sm text-muted-foreground">You have read-only access to these settings.</p>
          )}
        </form>
      )}
    </DashboardShell>
  );
}
