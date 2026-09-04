import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff — Custard Hotels" },
      { name: "description", content: "Manage hotel staff and permissions." },
      { property: "og:title", content: "Staff — Custard Hotels" },
      { property: "og:description", content: "Manage hotel staff and permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

function StaffPage() {
  return (
    <DashboardShell title="Staff">
      <PageHeader title="Staff" description="Invite and manage hotel team members." />
      <Card className="mt-6">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Staff invitations and role management are coming in the next update.
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
