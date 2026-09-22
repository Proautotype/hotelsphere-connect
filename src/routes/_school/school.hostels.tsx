import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ControllerShell } from "@/components/shared/ControllerShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { listSchoolHostels } from "@/lib/controller.functions";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_school/school/hostels")({
  head: () => ({
    meta: [
      { title: "Hostels — Custard Hotels" },
      { name: "description", content: "The hostels your school works with." },
    ],
  }),
  component: HostelsPage,
});

function HostelsPage() {
  const { activeController } = useAuth();
  const controllerId = activeController?.id ?? "";
  const list = useServerFn(listSchoolHostels);

  const { data: hostels = [] } = useQuery({
    queryKey: ["school", "hostels", controllerId],
    queryFn: () => list({ data: { controllerId } }),
    enabled: Boolean(controllerId),
  });

  return (
    <ControllerShell title="Hostels">
      <PageHeader
        title="Hostels"
        description="A hostel joins this list the first time it offers your school beds."
      />

      <div className="mt-6 space-y-3">
        {hostels.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No hostels yet"
            description="Publish an accommodation request and hostels that answer it will appear here."
          />
        ) : (
          hostels.map((h) => (
            <Card key={h.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-semibold text-foreground">
                      {h.hotel?.name ?? "Hostel"}
                    </p>
                    <StatusBadge status={h.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[h.hotel?.city, h.hotel?.address].filter(Boolean).join(" · ") ||
                      "No address on file"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[h.hotel?.phone, h.hotel?.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-medium text-foreground">{h.studentsPlaced} placed</p>
                  <p className="text-xs text-muted-foreground">{h.studentsCheckedIn} checked in</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ControllerShell>
  );
}
