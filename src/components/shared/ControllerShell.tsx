import { Link, useLocation } from "@tanstack/react-router";
import { Building2, GraduationCap, LayoutDashboard, Menu, Settings, Users, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { SignOutButton } from "./SignOutButton";
import { ControllerGate } from "./ControllerGate";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const NAV = [
  { to: "/school", label: "Dashboard", icon: LayoutDashboard },
  { to: "/school/requests", label: "Accommodation", icon: GraduationCap },
  { to: "/school/students", label: "Students", icon: Users },
  { to: "/school/hostels", label: "Hostels", icon: Building2 },
  { to: "/school/settings", label: "Settings", icon: Settings },
];

export function ControllerShell({ children, title }: { children: ReactNode; title?: string }) {
  const { profile, activeController, controllers, selectController, isPlatformAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const NavList = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active =
          item.to === "/school"
            ? location.pathname === "/school"
            : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={cn(
              "kinetic-label flex items-center gap-3 px-3 py-2.5 text-xs transition-all",
              active
                ? "ink bg-amber text-amber-foreground shadow-hard"
                : "border-[3px] border-transparent text-muted-foreground hover:border-ink hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
      {isPlatformAdmin ? (
        <Link
          to="/admin/schools"
          className="kinetic-label mt-2 flex items-center gap-3 border-[3px] border-dashed border-ink px-3 py-2.5 text-xs text-foreground transition-colors hover:bg-amber"
        >
          <LayoutDashboard className="size-5" />
          Platform Admin
        </Link>
      ) : null}
      <SignOutButton className="kinetic-label mt-auto flex items-center gap-3 border-[3px] border-transparent px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-ink hover:bg-destructive hover:text-destructive-foreground" />
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r-[3px] border-ink bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b-[3px] border-ink px-4">
          <span className="font-display text-2xl font-extrabold italic tracking-tighter text-foreground">
            SCHOOL<span className="text-amber">.</span>
          </span>
        </div>
        {NavList}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b-[3px] border-ink bg-card px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="ink size-9">
                  <Menu className="size-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 border-r-[3px] border-ink p-0">
                <div className="flex h-16 items-center justify-between border-b-[3px] border-ink px-4">
                  <span className="font-display text-xl font-extrabold italic tracking-tighter text-foreground">
                    SCHOOL<span className="text-amber">.</span>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                    <X className="size-5" />
                  </Button>
                </div>
                {NavList}
              </SheetContent>
            </Sheet>
            {title ? (
              <h1 className="kinetic-label truncate text-sm text-foreground lg:text-base">
                {title}
              </h1>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {controllers.length > 1 ? (
              <select
                className="ink hidden bg-background px-2 py-1.5 text-xs font-semibold sm:block"
                value={activeController?.id ?? ""}
                onChange={(e) => selectController(e.target.value || null)}
              >
                {controllers.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex items-center gap-3 border-l-[3px] border-ink pl-4">
              <span className="ink flex size-8 items-center justify-center bg-amber text-[11px] font-extrabold text-amber-foreground">
                {initials(profile?.full_name ?? "")}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm font-semibold text-foreground sm:inline">
                {profile?.full_name}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <ControllerGate>{children}</ControllerGate>
        </main>
      </div>
    </div>
  );
}
