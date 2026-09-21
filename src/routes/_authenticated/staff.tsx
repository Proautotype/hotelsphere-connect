import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  inviteStaffMember,
  lookupStaffRecipient,
  updateStaffMember,
  removeStaffMember,
} from "@/lib/staff.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Users } from "lucide-react";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  type PermissionKey,
  type StaffRole,
} from "@/lib/permissions";
import { titleCase } from "@/lib/format";

const ROLES: StaffRole[] = [
  "manager",
  "receptionist",
  "cashier",
  "accountant",
  "housekeeping",
  "restaurant",
  "other",
];

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({
    meta: [
      { title: "Staff & permissions — Custard Hotels" },
      {
        name: "description",
        content: "Invite hotel team members and control what each role can do.",
      },
      { property: "og:title", content: "Staff & permissions — Custard Hotels" },
      {
        property: "og:description",
        content: "Invite hotel team members and control what each role can do.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPage,
});

interface MemberRow {
  id: string;
  full_name: string;
  invited_email: string | null;
  user_id: string | null;
  staff_role: StaffRole;
  permissions: PermissionKey[];
  is_active: boolean;
  invite_status: string;
}

async function fetchMembers(hotelId: string | null) {
  if (!hotelId) return [] as MemberRow[];
  const { data, error } = await supabase
    .from("hotel_members")
    .select(
      "id, full_name, invited_email, user_id, staff_role, permissions, is_active, invite_status",
    )
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MemberRow[];
}

function StaffPage() {
  const { activeHotel, can } = useAuth();
  const hotelId = activeHotel?.id ?? null;
  const { data: members, refetch } = useSuspenseQuery({
    queryKey: ["staff", hotelId],
    queryFn: () => fetchMembers(hotelId),
  });

  const invite = useServerFn(inviteStaffMember);
  const update = useServerFn(updateStaffMember);
  const remove = useServerFn(removeStaffMember);
  const lookup = useServerFn(lookupStaffRecipient);

  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [recipient, setRecipient] = useState<{
    hasAccount: boolean;
    alreadyInvited: boolean;
    existingStatus: string;
  } | null>(null);
  const [form, setForm] = useState<{
    fullName: string;
    email: string;
    staffRole: StaffRole;
    permissions: PermissionKey[];
    createAccount: boolean;
    password: string;
  }>({
    fullName: "",
    email: "",
    staffRole: "receptionist",
    permissions: DEFAULT_ROLE_PERMISSIONS["receptionist"],
    createAccount: false,
    password: "",
  });

  const allowed = can("staff:manage");

  const togglePermission = (key: PermissionKey) =>
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));

  /** Works out whether the email belongs to an existing platform account so the form can offer the right path. */
  const checkRecipient = async () => {
    if (!hotelId || lookingUp) return;
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setRecipient(null);
      return;
    }
    setLookingUp(true);
    try {
      const info = await lookup({ data: { hotelId, email: form.email } });
      setRecipient(info);
      if (info.hasAccount && form.createAccount) {
        setForm((p) => ({ ...p, createAccount: false }));
      }
    } catch {
      setRecipient(null);
    } finally {
      setLookingUp(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    const password = Array.from(arr, (n) => chars[n % chars.length]).join("");
    setForm((p) => ({ ...p, password }));
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId) return;
    setBusy(true);
    try {
      const res = await invite({
        data: {
          hotelId,
          fullName: form.fullName,
          email: form.email,
          staffRole: form.staffRole,
          permissions: form.permissions,
          createAccount: form.createAccount,
          password: form.createAccount ? form.password : undefined,
        },
      });
      if (res.mode === "register") {
        toast.success(
          `Account created — share ${form.email.trim().toLowerCase()} and the password with ${form.fullName}.`,
        );
      } else if (res.mode === "invite") {
        toast.success("Invitation sent — they'll be added once they accept.");
      } else {
        toast.success("Invitation saved — access starts when they sign up");
      }
      setForm({
        fullName: "",
        email: "",
        staffRole: "receptionist",
        permissions: DEFAULT_ROLE_PERMISSIONS["receptionist"],
        createAccount: false,
        password: "",
      });
      setRecipient(null);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invitation failed");
    } finally {
      setBusy(false);
    }
  };

  const savePermissions = async (
    member: MemberRow,
    permissions: PermissionKey[],
    staffRole: StaffRole,
  ) => {
    setBusy(true);
    try {
      await update({ data: { memberId: member.id, permissions, staffRole } });
      toast.success("Permissions updated");
      setEditing(null);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (member: MemberRow) => {
    setBusy(true);
    try {
      await update({ data: { memberId: member.id, isActive: !member.is_active } });
      toast.success(member.is_active ? "Access suspended" : "Access restored");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: MemberRow) => {
    const pendingInvite = member.invite_status === "invited" && Boolean(member.user_id);
    if (
      !window.confirm(
        pendingInvite
          ? `Cancel the invitation for ${member.full_name}?`
          : `Remove ${member.full_name} from the team?`,
      )
    )
      return;
    setBusy(true);
    try {
      await remove({ data: { memberId: member.id } });
      toast.success(pendingInvite ? "Invitation cancelled" : "Team member removed");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell title="Staff">
      <PageHeader
        title="Staff"
        description="Invite team members and control exactly what each person can do."
      />

      {!allowed ? (
        <Card className="mt-6">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            You do not have permission to manage staff for this hotel.
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-3">
            {members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No team members yet"
                description="Invite your first staff member to share the workload."
              />
            ) : (
              members.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display font-semibold text-foreground">
                            {m.full_name}
                          </p>
                          <Badge variant="secondary">{titleCase(m.staff_role)}</Badge>
                          {m.invite_status === "invited" && m.user_id && (
                            <Badge variant="outline">Awaiting acceptance</Badge>
                          )}
                          {m.invite_status === "invited" && !m.user_id && (
                            <Badge variant="outline">Pending sign-up</Badge>
                          )}
                          {m.invite_status === "accepted" && !m.is_active && (
                            <Badge variant="destructive">Suspended</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{m.invited_email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {(m.permissions ?? []).length} permission
                          {(m.permissions ?? []).length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(editing === m.id ? null : m.id)}
                        >
                          {editing === m.id ? "Close" : "Permissions"}
                        </Button>
                        {m.invite_status === "accepted" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => toggleActive(m)}
                          >
                            {m.is_active ? "Suspend" : "Restore"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => removeMember(m)}
                        >
                          {m.invite_status === "invited" && m.user_id ? "Cancel invite" : "Remove"}
                        </Button>
                      </div>
                    </div>

                    {editing === m.id ? (
                      <PermissionEditor member={m} busy={busy} onSave={savePermissions} />
                    ) : null}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <Card className="h-fit">
            <CardContent className="p-5">
              <h3 className="kinetic-label text-xs text-foreground">Invite a team member</h3>
              <form onSubmit={submitInvite} className="mt-4 space-y-4">
                <div>
                  <Label htmlFor="staff-name">Full name</Label>
                  <Input
                    id="staff-name"
                    required
                    value={form.fullName}
                    onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    required
                    value={form.email}
                    onBlur={() => void checkRecipient()}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, email: e.target.value }));
                      if (recipient) setRecipient(null);
                    }}
                  />
                  {lookingUp ? (
                    <p className="mt-1 text-xs text-muted-foreground">Checking account…</p>
                  ) : recipient?.hasAccount ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Account found — they&apos;ll receive an invitation and be added once they
                      accept.
                    </p>
                  ) : recipient && form.createAccount ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No account found — a new one will be created and they&apos;ll be added
                      straight away.
                    </p>
                  ) : recipient && !form.createAccount ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No account found. Tick &quot;create an account&quot; below to register them
                      directly, or they&apos;ll be added when they sign up.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-primary"
                      checked={form.createAccount}
                      disabled={recipient?.hasAccount}
                      onChange={(e) => {
                        const createAccount = e.target.checked;
                        setForm((p) => ({
                          ...p,
                          createAccount,
                          password: createAccount ? p.password : "",
                        }));
                      }}
                    />
                    <span>
                      <span className="font-medium">Create an account for them</span>
                      <span className="block text-xs text-muted-foreground">
                        {recipient?.hasAccount
                          ? "They already have an account, so they'll be invited instead."
                          : "They don't have an account yet — you set a password and share it with them."}
                      </span>
                    </span>
                  </label>
                </div>
                {form.createAccount && (
                  <div>
                    <div className="flex items-end justify-between gap-2">
                      <Label htmlFor="staff-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                        onClick={generatePassword}
                      >
                        Generate
                      </button>
                    </div>
                    <Input
                      id="staff-password"
                      type="text"
                      required
                      minLength={8}
                      maxLength={72}
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="At least 8 characters"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Share this password with {form.fullName || "them"} — they sign in with it
                      straight away.
                    </p>
                  </div>
                )}
                <div>
                  <Label htmlFor="staff-role">Role</Label>
                  <select
                    id="staff-role"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.staffRole}
                    onChange={(e) => {
                      const role = e.target.value as StaffRole;
                      setForm((p) => ({
                        ...p,
                        staffRole: role,
                        permissions: DEFAULT_ROLE_PERMISSIONS[role],
                      }));
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {titleCase(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="mt-2 grid max-h-64 gap-1.5 overflow-y-auto pr-1">
                    {PERMISSIONS.map((p) => (
                      <label
                        key={p.key}
                        className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={form.permissions.includes(p.key)}
                          onChange={() => togglePermission(p.key)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy || !hotelId}>
                  <UserPlus className="mr-1 size-4" />{" "}
                  {busy
                    ? "Saving..."
                    : form.createAccount
                      ? "Create account & add"
                      : "Send invitation"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}

function PermissionEditor({
  member,
  busy,
  onSave,
}: {
  member: MemberRow;
  busy: boolean;
  onSave: (member: MemberRow, permissions: PermissionKey[], staffRole: StaffRole) => void;
}) {
  const [role, setRole] = useState<StaffRole>(member.staff_role);
  const [permissions, setPermissions] = useState<PermissionKey[]>(member.permissions ?? []);

  const toggle = (key: PermissionKey) =>
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));

  return (
    <div className="mt-4 border-t-[3px] border-ink pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor={`role-${member.id}`}>Role</Label>
          <select
            id={`role-${member.id}`}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={role}
            onChange={(e) => {
              const next = e.target.value as StaffRole;
              setRole(next);
              setPermissions(DEFAULT_ROLE_PERMISSIONS[next]);
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {titleCase(r)}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" disabled={busy} onClick={() => onSave(member, permissions, role)}>
          Save changes
        </Button>
      </div>
      <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSIONS.map((p) => (
          <label
            key={p.key}
            className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={permissions.includes(p.key)}
              onChange={() => toggle(p.key)}
            />
            {p.label}
          </label>
        ))}
      </div>
    </div>
  );
}
