import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Custard Hotels" },
      { name: "description", content: "Hotel and account settings." },
      { property: "og:title", content: "Settings — Custard Hotels" },
      { property: "og:description", content: "Hotel and account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { activeHotel, profile } = useAuth();

  return (
    <DashboardShell title="Settings">
      <PageHeader title="Settings" description="Hotel configuration and account details." />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="font-display font-semibold text-foreground">Hotel</h3>
            {activeHotel ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium text-foreground">{activeHotel.name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Currency</dt><dd className="font-medium text-foreground">{activeHotel.currency}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Status</dt><dd className="font-medium text-foreground capitalize">{activeHotel.status}</dd></div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">No hotel selected.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="font-display font-semibold text-foreground">Account</h3>
            {profile ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Name</dt><dd className="font-medium text-foreground">{profile.full_name}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Email</dt><dd className="font-medium text-foreground">{profile.email}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Phone</dt><dd className="font-medium text-foreground">{profile.phone ?? "—"}</dd></div>
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
