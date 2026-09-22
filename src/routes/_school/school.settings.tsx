import { createFileRoute } from "@tanstack/react-router";
import { ControllerShell } from "@/components/shared/ControllerShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_school/school/settings")({
  head: () => ({
    meta: [
      { title: "School settings — Custard Hotels" },
      { name: "description", content: "Your school's details on Custard." },
    ],
  }),
  component: SchoolSettings,
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value || "—"}</dd>
    </div>
  );
}

function SchoolSettings() {
  const { activeController, profile } = useAuth();

  return (
    <ControllerShell title="Settings">
      <PageHeader
        title="School settings"
        description="Custard keeps these details. Ask your Custard contact to change them."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h3 className="kinetic-label text-xs text-foreground">School</h3>
            <dl className="mt-3">
              <Row label="Name" value={activeController?.name ?? ""} />
              <Row label="Type" value={titleCase(activeController?.kind ?? "")} />
              <Row label="Status" value={titleCase(activeController?.status ?? "")} />
              <Row label="Town" value={activeController?.city ?? ""} />
              <Row label="Country" value={activeController?.country ?? ""} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="kinetic-label text-xs text-foreground">Your account</h3>
            <dl className="mt-3">
              <Row label="Name" value={profile?.full_name ?? ""} />
              <Row label="Email" value={profile?.email ?? ""} />
              <Row label="Role here" value={titleCase(activeController?.role ?? "")} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </ControllerShell>
  );
}
