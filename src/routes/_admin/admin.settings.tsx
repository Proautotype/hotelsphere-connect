import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { togglePlatformSetting } from "@/lib/hotels.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { dateTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_admin/admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform settings — Custard Hotels Admin" },
      { name: "description", content: "Control hotel approval mode and review the platform audit trail." },
      { property: "og:title", content: "Platform settings — Custard Hotels Admin" },
      { property: "og:description", content: "Control hotel approval mode and review the platform audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSettingsPage,
});

async function fetchSettings() {
  const [settings, audit] = await Promise.all([
    supabase.from("platform_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  return {
    settings: settings.data as unknown as {
      auto_approve_hotels: boolean;
      platform_name: string;
      support_email: string;
      commission_percent: number;
      updated_at: string;
    } | null,
    audit: (audit.data ?? []) as unknown as Array<{
      id: string;
      actor_name: string;
      action: string;
      resource: string;
      resource_id: string | null;
      created_at: string;
    }>,
  };
}

function AdminSettingsPage() {
  const { data, refetch } = useSuspenseQuery({ queryKey: ["admin", "settings"], queryFn: fetchSettings });
  const toggle = useServerFn(togglePlatformSetting);
  const [busy, setBusy] = useState(false);

  const onToggle = async (checked: boolean) => {
    setBusy(true);
    try {
      await toggle({ data: { autoApproveHotels: checked } });
      toast.success(checked ? "Hotels are now auto-approved" : "Hotels now need manual review");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Platform settings">
      <PageHeader title="Platform settings" description="Approval mode, platform identity, and the full audit trail." />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="kinetic-label text-xs text-foreground">Hotel approval</h3>
            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="auto-approve">Auto-approve new hotels</Label>
                <p className="text-sm text-muted-foreground">When off, every registration waits for manual review.</p>
              </div>
              <Switch
                id="auto-approve"
                disabled={busy}
                checked={Boolean(data.settings?.auto_approve_hotels)}
                onCheckedChange={onToggle}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="kinetic-label text-xs text-foreground">Platform</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium text-foreground">{data.settings?.platform_name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Support email</dt><dd className="font-medium text-foreground">{data.settings?.support_email}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Commission</dt><dd className="font-medium text-foreground">{data.settings?.commission_percent}%</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Updated</dt><dd className="font-medium text-foreground">{dateTime(data.settings?.updated_at)}</dd></div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="kinetic-label text-xs text-foreground">Audit trail</h3>
          {data.audit.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">Actor</th>
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">Action</th>
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">Resource</th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.audit.map((row) => (
                    <tr key={row.id} className="border-b border-border">
                      <td className="py-2 text-foreground">{row.actor_name || "System"}</td>
                      <td className="py-2 text-muted-foreground">{titleCase(row.action.replace(/\./g, " "))}</td>
                      <td className="py-2 text-muted-foreground">{titleCase(row.resource)}</td>
                      <td className="py-2 text-right text-muted-foreground">{dateTime(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
