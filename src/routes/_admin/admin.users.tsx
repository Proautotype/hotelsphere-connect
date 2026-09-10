import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<"all" | "platform" | "hotel" | "guest">("all");

  const kind = (u: AdminUserRow): "platform" | "hotel" | "guest" =>
    u.roles.some((r) => r.startsWith("platform_")) ? "platform" : u.hotels.length > 0 ? "hotel" : "guest";

  const counts = {
    all: users.length,
    platform: users.filter((u) => kind(u) === "platform").length,
    hotel: users.filter((u) => kind(u) === "hotel").length,
    guest: users.filter((u) => kind(u) === "guest").length,
  };

  const groups = [
    { key: "all" as const, label: "Everyone" },
    { key: "platform" as const, label: "Platform team" },
    { key: "hotel" as const, label: "Hotel people" },
    { key: "guest" as const, label: "Guests" },
  ];

  const q = query.trim().toLowerCase();
  const visible = users.filter((u) => {
    if (group !== "all" && kind(u) !== group) return false;
    if (!q) return true;
    return (
      u.full_name.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      u.hotels.some((h) => h.name.toLowerCase().includes(q))
    );
  });

  return (
    <AdminShell title="Accounts">
      <PageHeader title="Accounts" description="Everyone who has signed up, and where they belong." />

      <Card className="mt-6 border-l-[10px] border-l-amber">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              This list is view-only. Hotel owners and hotel staff can never be given platform powers from here — the platform team is
              managed on its own page.
            </span>
          </p>
          <Button asChild variant="secondary" className="shrink-0">
            <Link to="/admin/team">Platform team</Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroup(g.key)}
                className={
                  group === g.key
                    ? "ink bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground"
                    : "ink bg-card px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted"
                }
              >
                {g.label} · {counts[g.key]}
              </button>
            ))}
          </div>
          <div className="lg:ml-auto lg:w-72">
            <Input
              placeholder="Search name, email or hotel…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 space-y-2">
        {visible.length === 0 ? (
          <EmptyState icon={Users} title="No accounts found" description="Try a different search or group." />
        ) : (
          visible.map((user) => {
            const platform = user.roles.filter((r) => r.startsWith("platform_"));
            const type = kind(user);
            return (
              <Card key={user.id}>
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{user.full_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="min-w-0">
                    {user.hotels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {user.hotels.map((h) => (
                          <span
                            key={`${user.id}-${h.name}-${h.role}`}
                            className="ink bg-card px-2 py-1 text-xs text-foreground"
                          >
                            {h.name} · {h.role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No hotel</p>
                    )}
                  </div>
                  <div className="text-sm sm:text-right">
                    <p className="font-medium text-foreground">
                      {platform.length > 0
                        ? platform.map(titleCase).join(", ")
                        : type === "hotel"
                          ? "Hotel account"
                          : titleCase(user.roles[0] ?? "customer")}
                    </p>
                    <p className="text-xs text-muted-foreground">Joined {shortDate(user.created_at)}</p>
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
