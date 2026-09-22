import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  addControllerMember,
  createController,
  listControllers,
  updateControllerStatus,
} from "@/lib/controller.functions";
import { GraduationCap, Plus, UserPlus } from "lucide-react";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_admin/admin/schools")({
  head: () => ({
    meta: [
      { title: "Schools — Custard Hotels Admin" },
      { name: "description", content: "Create schools and link their staff accounts." },
    ],
  }),
  component: AdminSchoolsPage,
});

const BLANK_SCHOOL = {
  name: "",
  kind: "university" as "university" | "college" | "training" | "other",
  email: "",
  phone: "",
  city: "",
  address: "",
};

const BLANK_MEMBER = {
  email: "",
  fullName: "",
  role: "admin" as "admin" | "admissions" | "finance",
  createAccount: false,
  password: "",
};

function AdminSchoolsPage() {
  const queryClient = useQueryClient();
  const list = useServerFn(listControllers);
  const create = useServerFn(createController);
  const setStatus = useServerFn(updateControllerStatus);
  const addMember = useServerFn(addControllerMember);

  const [busy, setBusy] = useState(false);
  const [schoolOpen, setSchoolOpen] = useState(false);
  const [schoolForm, setSchoolForm] = useState(BLANK_SCHOOL);
  const [memberFor, setMemberFor] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState(BLANK_MEMBER);

  const { data } = useQuery({ queryKey: ["admin", "schools"], queryFn: () => list() });
  const schools = data?.schools ?? [];
  const members = data?.members ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin", "schools"] });

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

  const submitSchool = (e: React.FormEvent) => {
    e.preventDefault();
    void run("School created", async () => {
      await create({
        data: {
          name: schoolForm.name.trim(),
          kind: schoolForm.kind,
          email: schoolForm.email.trim() || undefined,
          phone: schoolForm.phone.trim() || undefined,
          city: schoolForm.city.trim(),
          address: schoolForm.address.trim(),
          country: "Ghana",
        },
      });
      setSchoolForm(BLANK_SCHOOL);
      setSchoolOpen(false);
    });
  };

  const submitMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberFor) return;
    void run("Member added", async () => {
      const result = await addMember({
        data: {
          controllerId: memberFor,
          email: memberForm.email.trim(),
          fullName: memberForm.fullName.trim(),
          role: memberForm.role,
          createAccount: memberForm.createAccount,
          password: memberForm.createAccount ? memberForm.password : undefined,
        },
      });
      if (result.createdAccount) toast.info("A new Custard account was created for them");
      setMemberForm(BLANK_MEMBER);
      setMemberFor(null);
    });
  };

  return (
    <AdminShell title="Schools">
      <PageHeader
        title="Schools"
        description="Universities and colleges that place students into hostels. Custard creates these; schools cannot sign themselves up."
        actions={
          <Dialog open={schoolOpen} onOpenChange={setSchoolOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 size-4" /> New school
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create a school</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitSchool} className="space-y-4">
                <div>
                  <Label htmlFor="sc-name">Name</Label>
                  <Input
                    id="sc-name"
                    required
                    placeholder="University of Ghana"
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="sc-kind">Type</Label>
                    <select
                      id="sc-kind"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={schoolForm.kind}
                      onChange={(e) =>
                        setSchoolForm((p) => ({
                          ...p,
                          kind: e.target.value as typeof p.kind,
                        }))
                      }
                    >
                      <option value="university">University</option>
                      <option value="college">College</option>
                      <option value="training">Training institute</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="sc-city">Town</Label>
                    <Input
                      id="sc-city"
                      value={schoolForm.city}
                      onChange={(e) => setSchoolForm((p) => ({ ...p, city: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sc-email">Email</Label>
                    <Input
                      id="sc-email"
                      type="email"
                      value={schoolForm.email}
                      onChange={(e) => setSchoolForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sc-phone">Phone</Label>
                    <Input
                      id="sc-phone"
                      value={schoolForm.phone}
                      onChange={(e) => setSchoolForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="sc-address">Address</Label>
                  <Input
                    id="sc-address"
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={busy || schoolForm.name.trim().length < 2}>
                  {busy ? "Working…" : "Create school"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mt-6 space-y-3">
        {schools.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No schools yet"
            description="Create one, then add the staff accounts that will post accommodation requests."
          />
        ) : (
          schools.map((school) => {
            const team = members.filter((m) => m.controller_id === school.id);
            return (
              <Card key={school.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display font-semibold text-foreground">{school.name}</p>
                        <StatusBadge status={school.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {titleCase(school.kind)} · {school.city || "No town"} · /{school.slug}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[school.email, school.phone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setMemberFor(school.id)}
                      >
                        <UserPlus className="mr-1 size-4" /> Add member
                      </Button>
                      {school.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            run("School suspended", () =>
                              setStatus({
                                data: { controllerId: school.id, status: "suspended" },
                              }),
                            )
                          }
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run("School activated", () =>
                              setStatus({ data: { controllerId: school.id, status: "active" } }),
                            )
                          }
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border pt-3">
                    {team.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No staff linked yet — nobody can open this school's workspace.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {team.map((m) => (
                          <p key={m.id} className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {m.full_name || m.email || "Member"}
                            </span>{" "}
                            · {titleCase(m.role)}
                            {m.is_active ? "" : " · inactive"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={memberFor !== null} onOpenChange={(v) => !v && setMemberFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add a school staff member</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitMember} className="space-y-4">
            <div>
              <Label htmlFor="cm-name">Full name</Label>
              <Input
                id="cm-name"
                required
                value={memberForm.fullName}
                onChange={(e) => setMemberForm((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cm-email">Email</Label>
              <Input
                id="cm-email"
                type="email"
                required
                value={memberForm.email}
                onChange={(e) => setMemberForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cm-role">Role</Label>
              <select
                id="cm-role"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={memberForm.role}
                onChange={(e) =>
                  setMemberForm((p) => ({ ...p, role: e.target.value as typeof p.role }))
                }
              >
                <option value="admin">Admin</option>
                <option value="admissions">Admissions</option>
                <option value="finance">Finance</option>
              </select>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox
                checked={memberForm.createAccount}
                onCheckedChange={(checked) =>
                  setMemberForm((p) => ({ ...p, createAccount: checked === true }))
                }
              />
              <span>
                <span className="block font-medium text-foreground">
                  They have no Custard account
                </span>
                <span className="block text-xs text-muted-foreground">
                  Create one now and set their first password.
                </span>
              </span>
            </label>
            {memberForm.createAccount ? (
              <div>
                <Label htmlFor="cm-password">Password</Label>
                <Input
                  id="cm-password"
                  type="password"
                  minLength={8}
                  required
                  value={memberForm.password}
                  onChange={(e) => setMemberForm((p) => ({ ...p, password: e.target.value }))}
                />
              </div>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? "Working…" : "Add member"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
