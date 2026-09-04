import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) {
      throw redirect({ to: "/dashboard" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
