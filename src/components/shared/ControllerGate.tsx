import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

function Panel({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="ink mx-auto mt-12 max-w-lg bg-card p-8 text-center">
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-6 flex justify-center gap-3">{action}</div> : null}
    </div>
  );
}

/**
 * Guards the school workspace, the way HotelGate guards a hotel's. Schools are
 * set up by the platform team, so there is nothing for a person to do here
 * until they have been added to one.
 */
export function ControllerGate({ children }: { children: ReactNode }) {
  const { loading, controllers, activeController, selectController, isPlatformAdmin } = useAuth();

  if (loading) return <>{children}</>;

  if (controllers.length === 0) {
    return isPlatformAdmin ? (
      <Panel
        title="You're on the platform team"
        body="School workspaces belong to the schools themselves. Create one and add its staff from the admin area."
        action={
          <Button asChild>
            <Link to="/admin/schools">Manage schools</Link>
          </Button>
        }
      />
    ) : (
      <Panel
        title="You're not on a school team yet"
        body="Schools are set up by Custard. Ask your administrator to add your account, then sign in again."
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    );
  }

  if (!activeController) {
    return (
      <div className="ink mx-auto mt-12 max-w-lg bg-card p-8">
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          Choose a school
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          You work with more than one. Pick the one you want to work on.
        </p>
        <div className="mt-6 space-y-2">
          {controllers.map((school) => (
            <button
              key={school.id}
              type="button"
              onClick={() => selectController(school.id)}
              className="ink block w-full bg-background p-4 text-left transition-colors hover:bg-amber"
            >
              <span className="block font-display text-sm font-extrabold tracking-tight">
                {school.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {school.city || school.country} · {school.role}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activeController.status === "suspended" || activeController.status === "rejected") {
    return (
      <Panel
        title={`${activeController.name} is ${activeController.status}`}
        body="This school cannot post accommodation requests at the moment. Get in touch with Custard to sort it out."
      />
    );
  }

  return <>{children}</>;
}
