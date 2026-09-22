import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ControllerShell } from "@/components/shared/ControllerShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  acceptAllocationOffer,
  assignStudents,
  cancelAccommodationRequest,
  getSchoolRequest,
  listStudents,
  publishAccommodationRequest,
} from "@/lib/controller.functions";
import { ArrowLeft } from "lucide-react";
import { money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_school/school/requests/$id")({
  head: () => ({
    meta: [
      { title: "Accommodation request — Custard Hotels" },
      { name: "description", content: "Offers and student placements for this request." },
    ],
  }),
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const { activeController } = useAuth();
  const controllerId = activeController?.id ?? "";
  const queryClient = useQueryClient();

  const getRequest = useServerFn(getSchoolRequest);
  const getStudents = useServerFn(listStudents);
  const publish = useServerFn(publishAccommodationRequest);
  const cancel = useServerFn(cancelAccommodationRequest);
  const accept = useServerFn(acceptAllocationOffer);
  const assign = useServerFn(assignStudents);

  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["school", "request", id],
    queryFn: () => getRequest({ data: { requestId: id } }),
  });
  const { data: students = [] } = useQuery({
    queryKey: ["school", "students", controllerId],
    queryFn: () => getStudents({ data: { controllerId } }),
    enabled: Boolean(controllerId),
  });

  const request = data?.request;
  const offers = data?.offers ?? [];
  const allocations = data?.allocations ?? [];
  const acceptedOffer = offers.find((o) => o.status === "accepted") ?? null;
  const placedIds = new Set(allocations.map((a) => a.student_id));
  const unplaced = students.filter((s) => !placedIds.has(s.id));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["school", "request", id] });
    await queryClient.invalidateQueries({ queryKey: ["school", "requests"] });
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!request) {
    return (
      <ControllerShell title="Request">
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      </ControllerShell>
    );
  }

  return (
    <ControllerShell title={request.title}>
      <Link
        to="/school/requests"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        <ArrowLeft className="size-4" /> All requests
      </Link>

      <PageHeader
        title={request.title}
        description={`${request.semester || "No term set"} · ${request.students_count} students · ${
          request.period_start ? shortDate(request.period_start) : "no start date"
        } → ${request.period_end ? shortDate(request.period_end) : "open-ended"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} />
            {request.status === "draft" ? (
              <Button
                disabled={busy}
                onClick={() =>
                  run("Request published to hostels", () =>
                    publish({ data: { requestId: request.id } }),
                  )
                }
              >
                Publish to hostels
              </Button>
            ) : null}
            {["draft", "published", "allocating"].includes(request.status) ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Request cancelled", () => cancel({ data: { requestId: request.id } }))
                }
              >
                Cancel
              </Button>
            ) : null}
          </div>
        }
      />

      {request.notes ? (
        <Card className="mt-6">
          <CardContent className="p-4 text-sm text-muted-foreground">{request.notes}</CardContent>
        </Card>
      ) : null}

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="kinetic-label text-xs text-foreground">Offers from hostels</h3>
          {offers.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {request.status === "draft"
                ? "Publish this request and hostels will be able to offer beds."
                : "No hostel has offered beds yet."}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {offers.map((o) => (
                <div
                  key={o.id}
                  className="ink flex flex-col gap-3 bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-extrabold tracking-tight">
                        {o.hotel?.name ?? "Hostel"}
                      </p>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.hotel?.city ?? "—"} · {o.beds_available} beds ·{" "}
                      {money(o.price_per_student, "GHS")} per student
                    </p>
                    {o.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{o.notes}</p>
                    ) : null}
                  </div>
                  {o.status === "offered" && !acceptedOffer ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        run("Offer accepted", () => accept({ data: { offerId: o.id } }))
                      }
                    >
                      Accept
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {acceptedOffer ? (
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="kinetic-label text-xs text-foreground">Assign students</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {allocations.length} of {acceptedOffer.beds_available} beds at{" "}
              {acceptedOffer.hotel?.name ?? "the hostel"} are taken. The hostel checks each student
              in on arrival.
            </p>

            {allocations.length > 0 ? (
              <div className="mt-4 space-y-1">
                {allocations.map((a) => {
                  const student = a.students as unknown as {
                    full_name: string;
                    student_ref: string;
                  } | null;
                  return (
                    <div
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0"
                    >
                      <span className="text-foreground">{student?.full_name ?? "Student"}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {student?.student_ref ? <span>{student.student_ref}</span> : null}
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {unplaced.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Every student on your register is placed.{" "}
                <Link to="/school/students" className="underline underline-offset-2">
                  Add more students
                </Link>
                .
              </p>
            ) : (
              <>
                <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
                  {unplaced.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-border py-2 text-sm last:border-0"
                    >
                      <Checkbox
                        checked={picked.includes(s.id)}
                        onCheckedChange={(checked) =>
                          setPicked((prev) =>
                            checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                          )
                        }
                      />
                      <span className="text-foreground">{s.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[s.student_ref, s.program, s.level_year].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  ))}
                </div>
                <Button
                  className="mt-4"
                  disabled={busy || picked.length === 0}
                  onClick={() =>
                    run(`${picked.length} student(s) assigned`, async () => {
                      await assign({
                        data: { offerId: acceptedOffer.id, studentIds: picked },
                      });
                      setPicked([]);
                    })
                  }
                >
                  {busy ? "Working…" : `Assign ${picked.length || ""} selected`}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </ControllerShell>
  );
}
