import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users } from "lucide-react";
import { shortDate } from "@/lib/format";

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
    await context.queryClient.ensureQueryData({
      queryKey: ["admin", "users"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*, user_roles(role)")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw new Error(error.message);
        return data ?? [];
      },
    });
  },
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { data: users } = useSuspenseQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return (
    <AdminShell title="Users">
      <PageHeader title="User accounts" description="Recent accounts and platform roles." />

      <div className="mt-6 space-y-3">
        {users.length === 0 ? (
          <EmptyState icon={Users} title="No users yet" description="User accounts will appear here." />
        ) : (
          (users as Array<{ id: string; full_name: string; email: string | null; created_at: string; user_roles: unknown }>).map((user) => {
            const roles = (user.user_roles as { role: string }[] | null)?.map((r) => r.role).join(", ") ?? "customer";
            return (
              <Card key={user.id}>
                <CardContent className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{user.full_name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <p className="capitalize">{roles}</p>
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
