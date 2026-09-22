import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ControllerShell } from "@/components/shared/ControllerShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { getSchoolOverview } from "@/lib/controller.functions";
import { Building2, DoorOpen, GraduationCap, Users } from "lucide-react";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_school/school/")({
  head: () => ({
    meta: [
      { title: "School dashboard — Custard Hotels" },
      { name: "description", content: "Accommodation for your students, at a glance." },
    ],
  }),
  component: SchoolDashboard,
});

function SchoolDashboard() {
  const { activeController } = useAuth();
  const controllerId = activeController?.id ?? "";
  const overview = useServerFn(getSchoolOverview);

  const { data } = useQuery({
    queryKey: ["school", "overview", controllerId],
    queryFn: () => overview({ data: { controllerId } }),
    enabled: Boolean(controllerId),
  });

  return (
    <ControllerShell title="Dashboard">
      <PageHeader
        title={activeController?.name ?? "School"}
        description="Accommodation for your students, at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/school/students">Add student</Link>
            </Button>
            <Button asChild>
              <Link to="/school/allocations">Place students</Link>
            </Button>
          </div>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={String(data?.studentCount ?? 0)} icon={Users} />
        <StatCard
          label="Placed"
          value={String(data?.placedCount ?? 0)}
          hint={`${Math.max(0, (data?.studentCount ?? 0) - (data?.placedCount ?? 0))} still to place`}
          icon={GraduationCap}
        />
        <StatCard label="Checked in" value={String(data?.checkedInCount ?? 0)} icon={DoorOpen} />
        <StatCard label="Hostels" value={String(data?.hostelCount ?? 0)} icon={Building2} />
      </div>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="kinetic-label text-xs text-foreground">Recent requests</h3>
          {(data?.recentRequests ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No accommodation requests yet.{" "}
              <Link to="/school/requests" className="underline underline-offset-2">
                Post your first one
              </Link>
              .
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {(data?.recentRequests ?? []).map((r) => (
                <Link
                  key={r.id}
                  to="/school/requests/$id"
                  params={{ id: r.id }}
                  className="ink flex flex-wrap items-center justify-between gap-2 bg-background p-3 transition-colors hover:bg-amber"
                >
                  <div className="min-w-0">
                    <p className="font-display text-sm font-extrabold tracking-tight">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.semester || "No term set"} · {r.students_count} students ·{" "}
                      {shortDate(r.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </ControllerShell>
  );
}
