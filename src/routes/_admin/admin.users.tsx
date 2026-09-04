import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { setPlatformAdmin } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { shortDate } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/_admin/admin/users")({
  head: () => ({
    meta: [
      { title: "Users — Custard Hotels Admin" },
      { name: "description", content: "View and manage user accounts on Custard Hotels." },
      { property: "og:title", content: "Users — Custard Hotels Admin" },
      { property: "og:description", content: "View and manage user accounts on Custard Hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["admin", "users"], queryFn: fetchAdminUsers });
  },
  errorComponent: ({ error }) => (
    <AdminShell title="Users">
      <div className="mt-6 border-[3px] border-ink bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Could not load users</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </AdminShell>
  ),
  component: AdminUsersPage,
});

interface AdminUserRow {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  roles: string[];
}

async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  const profiles = data ?? [];
  const ids = profiles.map((p) => p.id);
  const byUser = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
    for (const r of roles ?? []) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role as string]);
    }
  }
  return profiles.map((p) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
}

function AdminUsersPage() {
  const { data: users, refetch } = useSuspenseQuery({ queryKey: ["admin", "users"], queryFn: fetchAdminUsers });

  const changeRole = useServerFn(setPlatformAdmin);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");

  const setAdmin = async (email: string, grant: boolean) => {
    setBusy(email);
    try {
      await changeRole({ data: { email, grant } });
      toast.success(grant ? "Platform admin added" : "Platform admin removed");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AdminShell title="Users">
      <PageHeader title="User accounts" description="Recent accounts and platform roles." />

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-bold uppercase tracking-widest">
            Add a platform admin by email
            <input
              type="email"
              className="mt-1 w-full border-[2px] border-ink bg-transparent px-3 py-2 text-sm font-normal normal-case tracking-normal"
              placeholder="person@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>
          <Button
            disabled={!inviteEmail || busy === inviteEmail}
            onClick={async () => {
              await setAdmin(inviteEmail, true);
              setInviteEmail("");
            }}
          >
            Make platform admin
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {users.length === 0 ? (
          <EmptyState icon={Users} title="No users yet" description="User accounts will appear here." />
        ) : (
          users.map((user) => {
            const roles = user.roles.length > 0 ? user.roles.join(", ") : "customer";

            return (
              <Card key={user.id}>
                <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground sm:justify-end">
                    <div className="sm:text-right">
                      <p className="capitalize">{roles}</p>
                      <p className="text-xs">Joined {shortDate(user.created_at)}</p>
                    </div>
                    {user.email && (
                      <Button
                        size="sm"
                        variant={roles.includes("platform_admin") ? "outline" : "secondary"}
                        disabled={busy === user.email}
                        onClick={() => setAdmin(user.email as string, !roles.includes("platform_admin"))}
                      >
                        {roles.includes("platform_admin") ? "Remove admin" : "Make admin"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AdminShell>
  );
}
