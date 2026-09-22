import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ControllerShell } from "@/components/shared/ControllerShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { listSchoolRequests, saveAccommodationRequest } from "@/lib/controller.functions";
import { GraduationCap, Plus } from "lucide-react";
import { money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_school/school/requests/")({
  head: () => ({
    meta: [
      { title: "Accommodation requests — Custard Hotels" },
      { name: "description", content: "Ask hostels for beds for your students." },
    ],
  }),
  component: RequestsPage,
});

const BLANK = {
  title: "",
  semester: "",
  periodStart: "",
  periodEnd: "",
  studentsCount: "",
  budgetPerStudent: "",
  genderMix: "",
  preferredCity: "",
  notes: "",
};

function RequestsPage() {
  const { activeController } = useAuth();
  const controllerId = activeController?.id ?? "";
  const queryClient = useQueryClient();
  const list = useServerFn(listSchoolRequests);
  const save = useServerFn(saveAccommodationRequest);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(BLANK);

  const { data: requests = [] } = useQuery({
    queryKey: ["school", "requests", controllerId],
    queryFn: () => list({ data: { controllerId } }),
    enabled: Boolean(controllerId),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!controllerId || busy) return;
    setBusy(true);
    try {
      await save({
        data: {
          controllerId,
          title: form.title.trim(),
          semester: form.semester.trim(),
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          studentsCount: parseInt(form.studentsCount || "0", 10),
          budgetPerStudent: form.budgetPerStudent ? parseFloat(form.budgetPerStudent) : null,
          genderMix: form.genderMix.trim(),
          preferredCity: form.preferredCity.trim(),
          notes: form.notes.trim(),
        },
      });
      toast.success("Request saved as a draft");
      setForm(BLANK);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["school", "requests"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this request");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ControllerShell title="Accommodation requests">
      <PageHeader
        title="Accommodation requests"
        description="Tell hostels how many students you need beds for, then compare their offers."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 size-4" /> New request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New accommodation request</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="ar-title">Title</Label>
                  <Input
                    id="ar-title"
                    required
                    placeholder="2026/27 · Semester 1"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="ar-semester">Term</Label>
                    <Input
                      id="ar-semester"
                      placeholder="Semester 1"
                      value={form.semester}
                      onChange={(e) => setForm((p) => ({ ...p, semester: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ar-count">Students</Label>
                    <Input
                      id="ar-count"
                      type="number"
                      min={0}
                      value={form.studentsCount}
                      onChange={(e) => setForm((p) => ({ ...p, studentsCount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ar-start">Period starts</Label>
                    <Input
                      id="ar-start"
                      type="date"
                      value={form.periodStart}
                      onChange={(e) => setForm((p) => ({ ...p, periodStart: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ar-end">Period ends</Label>
                    <Input
                      id="ar-end"
                      type="date"
                      value={form.periodEnd}
                      onChange={(e) => setForm((p) => ({ ...p, periodEnd: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leave empty for an open-ended stay.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ar-budget">Budget per student</Label>
                    <Input
                      id="ar-budget"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.budgetPerStudent}
                      onChange={(e) => setForm((p) => ({ ...p, budgetPerStudent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ar-city">Preferred town</Label>
                    <Input
                      id="ar-city"
                      value={form.preferredCity}
                      onChange={(e) => setForm((p) => ({ ...p, preferredCity: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ar-gender">Gender mix</Label>
                  <Input
                    id="ar-gender"
                    placeholder="Mixed, or 24 female / 16 male"
                    value={form.genderMix}
                    onChange={(e) => setForm((p) => ({ ...p, genderMix: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="ar-notes">Notes for hostels</Label>
                  <Textarea
                    id="ar-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={busy || form.title.trim().length < 2}>
                  {busy ? "Saving…" : "Save draft"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-6 space-y-3">
        {requests.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No requests yet"
            description="Post one to tell hostels how many students need beds and when."
          />
        ) : (
          requests.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/school/requests/$id"
                      params={{ id: r.id }}
                      className="font-display font-semibold text-foreground underline decoration-2 underline-offset-4"
                    >
                      {r.title}
                    </Link>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.semester || "No term set"} · {r.students_count} students
                    {r.budget_per_student
                      ? ` · up to ${money(r.budget_per_student, "GHS")} each`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.period_start ? shortDate(r.period_start) : "No start date"} →{" "}
                    {r.period_end ? shortDate(r.period_end) : "open-ended"}
                  </p>
                </div>
                <div className="text-sm sm:text-right">
                  <p className="font-medium text-foreground">
                    {r.offers.length} offer{r.offers.length === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.assignedCount} students placed</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ControllerShell>
  );
}
