import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ControllerShell } from "@/components/shared/ControllerShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { listStudents, saveStudent } from "@/lib/controller.functions";
import { Plus, Search, Users } from "lucide-react";

export const Route = createFileRoute("/_school/school/students")({
  head: () => ({
    meta: [
      { title: "Students — Custard Hotels" },
      { name: "description", content: "Your student register." },
    ],
  }),
  component: StudentsPage,
});

const BLANK = {
  fullName: "",
  studentRef: "",
  program: "",
  levelYear: "",
  gender: "",
  phone: "",
  email: "",
  guardianName: "",
  guardianPhone: "",
};

function StudentsPage() {
  const { activeController } = useAuth();
  const controllerId = activeController?.id ?? "";
  const queryClient = useQueryClient();
  const list = useServerFn(listStudents);
  const save = useServerFn(saveStudent);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(BLANK);

  const { data: students = [] } = useQuery({
    queryKey: ["school", "students", controllerId],
    queryFn: () => list({ data: { controllerId } }),
    enabled: Boolean(controllerId),
  });

  const q = query.trim().toLowerCase();
  const filtered = q
    ? students.filter((s) =>
        [s.full_name, s.student_ref, s.program, s.level_year]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
    : students;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!controllerId || busy) return;
    setBusy(true);
    try {
      await save({
        data: {
          controllerId,
          fullName: form.fullName.trim(),
          studentRef: form.studentRef.trim(),
          program: form.program.trim(),
          levelYear: form.levelYear.trim(),
          gender: form.gender.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim(),
          guardianName: form.guardianName.trim(),
          guardianPhone: form.guardianPhone.trim(),
          notes: "",
        },
      });
      toast.success(`${form.fullName.trim()} added`);
      setForm(BLANK);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["school", "students"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this student");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ControllerShell title="Students">
      <PageHeader
        title="Students"
        description="The register you place into hostel accommodation."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 size-4" /> Add student
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add a student</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="st-name">Full name</Label>
                  <Input
                    id="st-name"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="st-ref">Student ID</Label>
                    <Input
                      id="st-ref"
                      value={form.studentRef}
                      onChange={(e) => setForm((p) => ({ ...p, studentRef: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-gender">Gender</Label>
                    <Input
                      id="st-gender"
                      value={form.gender}
                      onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-program">Programme</Label>
                    <Input
                      id="st-program"
                      value={form.program}
                      onChange={(e) => setForm((p) => ({ ...p, program: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-level">Level / year</Label>
                    <Input
                      id="st-level"
                      value={form.levelYear}
                      onChange={(e) => setForm((p) => ({ ...p, levelYear: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-phone">Phone</Label>
                    <Input
                      id="st-phone"
                      value={form.phone}
                      onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-email">Email</Label>
                    <Input
                      id="st-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-guardian">Guardian</Label>
                    <Input
                      id="st-guardian"
                      value={form.guardianName}
                      onChange={(e) => setForm((p) => ({ ...p, guardianName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="st-guardian-phone">Guardian phone</Label>
                    <Input
                      id="st-guardian-phone"
                      value={form.guardianPhone}
                      onChange={(e) => setForm((p) => ({ ...p, guardianPhone: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={busy || form.fullName.trim().length < 2}>
                  {busy ? "Saving…" : "Add student"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, student ID or programme"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={students.length === 0 ? "No students yet" : "No students match that search"}
            description={
              students.length === 0
                ? "Add the students you need to find accommodation for."
                : "Try a different name or student ID."
            }
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[s.student_ref, s.program, s.level_year, s.gender]
                        .filter(Boolean)
                        .join(" · ") || "No details"}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{s.phone ?? s.email ?? ""}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </ControllerShell>
  );
}
