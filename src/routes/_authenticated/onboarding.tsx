import { createFileRoute, Link } from "@tanstack/react-router";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, Circle, Building2, BedDouble, Image, Settings, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding — Custard Hotels" },
      { name: "description", content: "Complete your hotel setup on Custard Hotels." },
      { property: "og:title", content: "Onboarding — Custard Hotels" },
      { property: "og:description", content: "Complete your hotel setup on Custard Hotels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

const STEPS = [
  { label: "Property details", icon: Building2, done: true },
  { label: "Branding & photos", icon: Image, done: false },
  { label: "Room types", icon: BedDouble, done: false },
  { label: "Rooms & pricing", icon: BedDouble, done: false },
  { label: "Payment methods", icon: CreditCard, done: false },
  { label: "Go live", icon: Settings, done: false },
];

function OnboardingPage() {
  const { activeHotel } = useAuth();

  return (
    <DashboardShell title="Onboarding">
      <PageHeader title="Complete your hotel setup" description="Work through the steps to start taking bookings." />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, i) => {
          const Icon = step.done ? CheckCircle2 : step.icon;
          return (
            <Card key={step.label} className={step.done ? "border-success/30 bg-success/5" : ""}>
              <CardContent className="flex items-start gap-4 p-5">
                <span className={step.done ? "text-success" : "text-muted-foreground"}>
                  <Icon className="size-6" />
                </span>
                <div>
                  <p className="font-medium text-foreground">{i + 1}. {step.label}</p>
                  <p className="text-sm text-muted-foreground">{step.done ? "Completed" : "Pending"}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link to="/rooms">Go to rooms</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/settings">Edit hotel settings</Link>
        </Button>
      </div>
    </DashboardShell>
  );
}
