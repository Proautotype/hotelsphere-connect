import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Users } from "lucide-react";
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_admin/admin/users")({
  head: () => ({
    meta: [
      { title: "Accounts — Custard Hotels Admin" },
      { name: "description", content: "Browse every account on Custard Hotels and see which hotel each person belongs to." },
      { property: "og:title", content: "Accounts — Custard Hotels Admin" },
      { property: "og:description", content: "Browse every account on Custard Hotels and see which hotel each person belongs to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({ queryKey: ["admin", "users"], queryFn: fetchAdminUsers });
  },
  errorComponent: ({ error }) => (
    <AdminShell title="Accounts">
      <div className="mt-6 border-[3px] border-ink bg-card p-6">
        <h2 className="font-display text-xl font-semibold">Could not load accounts</h2>
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
  hotels: { name: string; role: string }[];
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
  const hotelsByUser = new Map<string, { name: string; role: string }[]>();

  if (ids.length > 0) {
    const [{ data: roles }, { data: owned }, { data: members }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      supabase.from("hotels").select("name, owner_id").in("owner_id", ids),
      supabase.from("hotel_members").select("user_id, staff_role, hotel_id, is_active").in("user_id", ids),
    ]);
    for (const r of roles ?? []) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role as string]);
    }
    for (const h of owned ?? []) {
      if (!h.owner_id) continue;
      hotelsByUser.set(h.owner_id, [...(hotelsByUser.get(h.owner_id) ?? []), { name: h.name, role: "Owner" }]);
    }
    const hotelIds = [...new Set((members ?? []).map((m) => m.hotel_id))];
    const names = new Map<string, string>();
    if (hotelIds.length > 0) {
      const { data: hotelRows } = await supabase.from("hotels").select("id, name").in("id", hotelIds);
      for (const h of hotelRows ?? []) names.set(h.id, h.name);
    }
    for (const m of members ?? []) {
      if (!m.user_id) continue;
      hotelsByUser.set(m.user_id, [
        ...(hotelsByUser.get(m.user_id) ?? []),
        { name: names.get(m.hotel_id) ?? "Hotel", role: `${titleCase(m.staff_role)}${m.is_active ? "" : " (suspended)"}` },
      ]);
    }
  }

  return profiles.map((p) => ({ ...p, roles: byUser.get(p.id) ?? [], hotels: hotelsByUser.get(p.id) ?? [] }));
}

function AdminUsersPage() {
  const { data: users } = useSuspenseQuery({ queryKey: ["admin", "users"], queryFn: fetchAdminUsers });

  return (
    <AdminShell title="Accounts">
      <PageHeader title="Accounts" description="Everyone who has signed up, and where they belong." />

      <Card className="mt-6 border-l-[10px] border-l-amber">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              This list is view-only. Hotel owners and hotel staff can never be given platform powers from here — the platform team is managed on
              its own page.
            </span>
          </p>
          <Button asChild variant="secondary">
            <Link to="/admin/team">Platform team</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        {users.length === 0 ? (
          <EmptyState icon={Users} title="No accounts yet" description="Accounts will appear here as people sign up." />
        ) : (
          users.map((user) => {
            const platform = user.roles.filter((r) => r.startsWith("platform_"));
            return (
              <Card key={user.id}>
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.hotels.length > 0 && (
                      <p className="mt-1 text-sm">
                        {user.hotels.map((h) => `${h.name} — ${h.role}`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <p className="font-medium text-foreground">
                      {platform.length > 0
                        ? platform.map(titleCase).join(", ")
                        : user.hotels.length > 0
                          ? "Hotel account"
                          : titleCase(user.roles[0] ?? "customer")}
                    </p>
                    <p className="text-xs">Joined {shortDate(user.created_at)}</p>
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
