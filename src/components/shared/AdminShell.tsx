import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Building2, Users, Settings, Globe, Menu, X, ShieldCheck, CreditCard, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SignOutButton } from "./SignOutButton";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/hotels", label: "Hotels", icon: Building2 },
  { to: "/admin/users", label: "Accounts", icon: Users },
  { to: "/admin/team", label: "Platform team", icon: ShieldCheck },
  { to: "/admin/plans", label: "Plans & billing", icon: CreditCard },
  { to: "/admin/requests", label: "Requests", icon: Inbox },
  { to: "/admin/discovery", label: "Discovery", icon: Globe },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children, title }: { children: ReactNode; title?: string }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const NavList = (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
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
      <Link
        to="/dashboard"
        className="kinetic-label mt-2 flex items-center gap-3 border-[3px] border-dashed border-ink px-3 py-2.5 text-xs text-foreground transition-colors hover:bg-amber"
      >
        <LayoutDashboard className="size-5" />
        Hotel Dashboard
      </Link>
      <SignOutButton className="kinetic-label mt-auto flex items-center gap-3 border-[3px] border-transparent px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-ink hover:bg-destructive hover:text-destructive-foreground" />
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r-[3px] border-ink bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b-[3px] border-ink px-4">
          <span className="font-display text-2xl font-extrabold italic tracking-tighter text-foreground">
            ADMIN<span className="text-amber">.</span>
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
                    ADMIN<span className="text-amber">.</span>
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                    <X className="size-5" />
                  </Button>
                </div>
                {NavList}
              </SheetContent>
            </Sheet>
            {title ? (
              <h1 className="kinetic-label truncate text-sm text-foreground lg:text-base">{title}</h1>
            ) : null}
          </div>
          <div className="flex items-center gap-3 border-l-[3px] border-ink pl-4">
            <span className="ink flex size-8 items-center justify-center bg-amber text-[11px] font-extrabold text-amber-foreground">
              {initials(profile?.full_name ?? "")}
            </span>
            <span className="hidden max-w-[120px] truncate text-sm font-semibold text-foreground sm:inline">
              {profile?.full_name}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
