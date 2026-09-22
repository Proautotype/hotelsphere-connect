import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_school")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }

    // Platform admins can look in; everyone else needs to be on a school team.
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) {
      const { data: membership } = await supabase
        .from("controller_members")
        .select("id")
        .eq("user_id", data.user.id)
        .eq("is_active", true)
        .limit(1);
      if (!membership || membership.length === 0) {
        throw redirect({ to: "/dashboard" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
