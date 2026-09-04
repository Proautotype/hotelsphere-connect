import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Clock, Search, ShieldAlert, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

function Panel({
  icon,
  title,
  body,
  actions,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <div className="ink mx-auto flex max-w-xl flex-col items-start gap-4 bg-card p-8 shadow-hard">
      <span className="ink flex size-12 items-center justify-center bg-amber text-amber-foreground">{icon}</span>
      <h2 className="font-display text-3xl font-extrabold italic tracking-tighter text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
    </div>
  );
}

/** Blocks hotel operations until the signed-in person actually runs an approved hotel. */
export function HotelGate({ children, allow = false }: { children: ReactNode; allow?: boolean }) {
  const { loading, hotels, activeHotel, isPlatformAdmin, selectHotel, profile } = useAuth();

  if (loading) return <>{children}</>;
  if (isPlatformAdmin && !activeHotel) {
    return (
      <Panel
        icon={<ShieldAlert className="size-6" />}
        title="You're on the platform team"
        body="Platform admins don't run a hotel themselves. Head to the Platform area to review hotel applications, manage users and curate the public search page."
        actions={
          <Button asChild>
            <Link to="/admin">Open Platform Admin</Link>
          </Button>
        }
      />
    );
  }

  if (hotels.length === 0) {
    return (
      <Panel
        icon={<Building2 className="size-6" />}
        title="You don't manage a hotel yet"
        body="Register your property to get a private hotel workspace — rooms, bookings, reception, payments and staff. Custard Hotels reviews every application before it goes live. If you were invited as staff, ask the owner to re-send the invite to this email address."
        actions={
          <>
            <Button asChild>
              <Link to="/register">Register your hotel</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/discover">
                <Search className="mr-2 size-4" />
                Browse hotels
              </Link>
            </Button>
          </>
        }
      />
    );
  }

  if (hotels.length > 1 && !activeHotel) {
    return (
      <div className="ink mx-auto flex max-w-2xl flex-col gap-5 bg-card p-8 shadow-hard">
        <div>
          <h2 className="font-display text-3xl font-extrabold italic tracking-tighter text-foreground">
            Choose a workplace
          </h2>
          <p className="pt-2 text-sm text-muted-foreground">
            {profile?.full_name ? `Welcome back, ${profile.full_name.split(" ")[0]}. ` : ""}
            You work with more than one hotel. Pick the one you&apos;re working on — you can switch any time from the
            hotel name at the top of the screen.
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {hotels.map((hotel) => (
            <li key={hotel.id}>
              <button
                type="button"
                onClick={() => selectHotel(hotel.id)}
                className="ink flex w-full items-center gap-4 bg-background p-4 text-left transition-all hover:bg-amber hover:text-amber-foreground hover:shadow-hard"
              >
                <span className="ink flex size-11 shrink-0 items-center justify-center bg-primary text-primary-foreground">
                  <Building2 className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg font-extrabold tracking-tight">{hotel.name}</span>
                  <span className="kinetic-label block pt-1 text-[10px] opacity-70">
                    {hotel.relation === "owner" ? "Owner" : (hotel.staff_role ?? "Staff").replace("_", " ")}
                    {hotel.status !== "active" ? ` · ${hotel.status}` : ""}
                  </span>
                </span>
                <ArrowRight className="size-5 shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (allow || !activeHotel || activeHotel.status === "active") return <>{children}</>;

  if (activeHotel.status === "pending") {
    return (
      <Panel
        icon={<Clock className="size-6" />}
        title="Awaiting approval"
        body={`${activeHotel.name} has been submitted to Custard Hotels. A platform reviewer checks your details and approves or rejects the application — you'll get a notification here as soon as that happens. Until then you can keep editing your hotel details.`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/settings">Review hotel details</Link>
          </Button>
        }
      />
    );
  }

  if (activeHotel.status === "suspended") {
    return (
      <Panel
        icon={<ShieldAlert className="size-6" />}
        title="This hotel is suspended"
        body={`${activeHotel.name} has been suspended by Custard Hotels, so day-to-day operations are paused. Contact support to resolve it and have the hotel reactivated.`}
      />
    );
  }

  return (
    <Panel
      icon={<XCircle className="size-6" />}
      title={activeHotel.status === "rejected" ? "Application not approved" : "This hotel is archived"}
      body={
        activeHotel.status === "rejected"
          ? `${activeHotel.name} was not approved by Custard Hotels. Update your hotel details and contact support to have the application looked at again.`
          : `${activeHotel.name} has been archived and no longer accepts bookings.`
      }
      actions={
        <Button variant="outline" asChild>
          <Link to="/settings">Review hotel details</Link>
        </Button>
      }
    />
  );
}
