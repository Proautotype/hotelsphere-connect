import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck, Eye } from "lucide-react";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listPlatformTeam, setPlatformTeamRole } from "@/lib/admin.functions";
import { shortDate, titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_admin/admin/team")({
  head: () => ({
    meta: [
      { title: "Platform team — Custard Hotels Admin" },
      { name: "description", content: "Manage who runs the Custard Hotels platform: admins and support staff." },
      { property: "og:title", content: "Platform team — Custard Hotels Admin" },
      { property: "og:description", content: "Manage who runs the Custard Hotels platform: admins and support staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformTeamPage,
});

function PlatformTeamPage() {
  const { isPlatformAdmin } = useAuth();
  const fetchTeam = useServerFn(listPlatformTeam);
  const changeRole = useServerFn(setPlatformTeamRole);

  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin", "platform-team"], queryFn: () => fetchTeam() });

  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [role, setRole] = useState<"platform_admin" | "platform_support">("platform_support");
  const [busy, setBusy] = useState(false);

  const submit = async (grant: boolean, payload?: { email: string; role: "platform_admin" | "platform_support" }) => {
    const target = payload ?? { email, role };
    setBusy(true);
    try {
      await changeRole({
        data: {
          email: target.email,
          confirmEmail: payload ? target.email : confirmEmail,
          role: target.role,
          grant,
        },
      });
      toast.success(grant ? "Added to the platform team" : "Removed from the platform team");
      setEmail("");
      setConfirmEmail("");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the platform team");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Platform team">
      <PageHeader
        title="Platform team"
        description="The people who run Custard Hotels itself. Hotel owners and hotel staff can never be added here."
      />

      <Card className="mt-6 border-l-[10px] border-l-amber">
        <CardContent className="space-y-2 p-6 text-sm">
          <p className="flex items-start gap-2 text-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Platform admin</strong> approves hotels, sets plans, fees and commission, reviews advertising, and manages this team.
            </span>
          </p>
          <p className="flex items-start gap-2 text-muted-foreground">
            <Eye className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Platform support</strong> can look at everything to help, but cannot approve hotels, change money settings, or grant roles.
            </span>
          </p>
        </CardContent>
      </Card>

      {isPlatformAdmin && (
        <Card className="mt-6">
          <CardContent className="space-y-4 p-6">
            <h3 className="kinetic-label text-xs text-foreground">Add someone to the platform team</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="team-email">Their email</Label>
                <Input id="team-email" type="email" value={email} placeholder="person@custardhotels.com" onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="team-confirm">Type the email again</Label>
                <Input id="team-confirm" type="email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="team-role">Level</Label>
                <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                  <SelectTrigger id="team-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform_support">Platform support (view only)</SelectItem>
                    <SelectItem value="platform_admin">Platform admin (full control)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The account must already have signed up, and must not own or work at any hotel.
            </p>
            <Button disabled={busy || !email || !confirmEmail} onClick={() => submit(true)}>
              Add to platform team
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading the team…</p>
        ) : (data?.length ?? 0) === 0 ? (
          <EmptyState icon={ShieldCheck} title="No platform team yet" description="Add the first platform admin above." />
        ) : (
          data!.map((member) => (
            <Card key={`${member.userId}-${member.role}`}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="sm:text-right">
                    <p className="font-medium text-foreground">{titleCase(member.role)}</p>
                    <p className="text-xs text-muted-foreground">Since {shortDate(member.since)}</p>
                  </div>
                  {isPlatformAdmin && member.email && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        submit(false, { email: member.email as string, role: member.role as "platform_admin" | "platform_support" })
                      }
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminShell>
  );
}
