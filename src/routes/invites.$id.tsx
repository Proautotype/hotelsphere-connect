import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStaffInvitation, respondStaffInvitation } from "@/lib/staff.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/lib/permissions";
import { titleCase } from "@/lib/format";
import { toast } from "sonner";
import { Building2, CheckCircle2, Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/invites/$id")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  loader: async ({ params }) => getStaffInvitation({ data: { memberId: params.id } }),
  head: () => ({
    meta: [
      { title: "Team invitation — Custard Hotels" },
      { name: "description", content: "Accept or decline your Custard Hotels team invitation." },
      { property: "og:title", content: "Team invitation — Custard Hotels" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: InvitePage,
  errorComponent: () => (
    <InviteShell>
      <XCircle className="mx-auto size-10 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl font-extrabold italic tracking-tighter">
        Invitation not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This invitation may have been cancelled, declined, or already used. Ask the hotel manager to
        send it again.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </InviteShell>
  ),
});

interface InvitationData {
  memberId: string;
  hotel: { name: string; logoUrl: string | null; slug: string; city: string | null } | null;
  fullName: string;
  email: string | null;
  staffRole: string;
  permissions: string[];
  isActive: boolean;
  inviteStatus: string;
  isMine: boolean;
  userId: string;
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-sand px-5 py-12">
      <div className="relative w-full max-w-md animate-rise ink bg-card shadow-hard-lg">
        <div className="border-b-[3px] border-ink px-6 py-4 text-center">
          <Link to="/" className="font-display text-2xl font-extrabold italic tracking-tighter">
            CUSTARD<span className="text-primary">.</span>
          </Link>
        </div>
        <div className="p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

function InvitePage() {
  const invite = Route.useLoaderData() as unknown as InvitationData;
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<"" | "accept" | "decline">("");
  const [state, setState] = useState<"pending" | "accepted" | "declined">(
    invite.inviteStatus === "accepted" && invite.isActive ? "accepted" : "pending",
  );

  const alreadyMember = invite.inviteStatus === "accepted" && invite.isActive;

  const accept = async () => {
    setBusy("accept");
    try {
      const res = await respondStaffInvitation({ data: { memberId: id, action: "accept" } });
      if (res.ok) {
        await refresh();
        setState("accepted");
        toast.success("Welcome to the team!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept the invitation");
      setBusy("");
    }
  };

  const decline = async () => {
    if (
      !window.confirm(
        "Decline this invitation? The manager will be able to invite you again later.",
      )
    )
      return;
    setBusy("decline");
    try {
      const res = await respondStaffInvitation({ data: { memberId: id, action: "decline" } });
      if (res.ok) {
        setState("declined");
        toast.success("Invitation declined");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not decline the invitation");
      setBusy("");
    }
  };

  if (!invite.isMine && !alreadyMember) {
    return (
      <InviteShell>
        <XCircle className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-3xl font-extrabold italic tracking-tighter">
          Not your invitation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invitation was sent to {invite.email ?? "a different account"}. Sign in with that
          account to accept it.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </InviteShell>
    );
  }

  if (state === "declined") {
    return (
      <InviteShell>
        <XCircle className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 font-display text-3xl font-extrabold italic tracking-tighter">
          Invitation declined
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve declined this invitation. The hotel manager has been notified and can invite
          you again later.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </InviteShell>
    );
  }
  return (
    <InviteShell>
      <div className="text-center">
        <span className="ink -rotate-1 inline-block bg-amber px-3 py-1 kinetic-label text-[10px] text-amber-foreground">
          {alreadyMember ? "YOU'RE ON THE TEAM" : "TEAM INVITATION"}
        </span>
        <h1 className="mt-4 font-display text-4xl font-extrabold uppercase leading-[0.85] tracking-tighter">
          {invite.hotel?.name ?? "Our hotel"}
        </h1>
        {invite.hotel?.city ? (
          <p className="mt-1 text-sm text-muted-foreground">{invite.hotel.city}</p>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {alreadyMember ? (
            <>
              You&apos;re already a member of{" "}
              <strong className="text-foreground">{invite.hotel?.name}</strong>. Head back to your
              dashboard to get started.
            </>
          ) : (
            <>
              You&apos;ve been invited to work at {invite.hotel?.name} as{" "}
              <strong className="text-foreground">
                {titleCase(invite.staffRole.replace(/_/g, " "))}
              </strong>
              . Accepting gives you access to this hotel&apos;s workspace with the permissions
              below.
            </>
          )}
        </p>

        {!alreadyMember && (
          <>
            <div className="border-[2px] border-ink bg-background p-4">
              <p className="kinetic-label text-xs uppercase tracking-widest text-foreground">
                Your role
              </p>
              <p className="mt-1 font-medium">{titleCase(invite.staffRole.replace(/_/g, " "))}</p>
              <p className="kinetic-label mt-4 text-xs uppercase tracking-widest text-foreground">
                Permissions
              </p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {(invite.permissions ?? []).map((key) => (
                  <li key={key} className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                    {PERMISSIONS.find((p) => p.key === key)?.label ??
                      titleCase(key.replace(/_/g, " "))}
                  </li>
                ))}
              </ul>
              {(invite.permissions ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">View-only access</p>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1" disabled={busy !== ""} onClick={accept}>
                {busy === "accept" ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Building2 className="mr-2 size-4" />
                )}
                {busy === "accept" ? "Accepting…" : "Accept invitation"}
              </Button>
              <Button variant="outline" className="flex-1" disabled={busy !== ""} onClick={decline}>
                {busy === "decline" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {busy === "decline" ? "Declining…" : "Decline"}
              </Button>
            </div>
          </>
        )}

        {alreadyMember && (
          <Button asChild className="w-full">
            <Link to="/dashboard">Open your dashboard</Link>
          </Button>
        )}
      </div>
    </InviteShell>
  );
}
