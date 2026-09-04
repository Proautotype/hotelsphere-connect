import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CalendarDays,
  BedDouble,
  DoorOpen,
  Sparkles,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { HotelSwitcher } from "./HotelSwitcher";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/rooms", label: "Rooms", icon: BedDouble },
  { to: "/reception", label: "Reception", icon: DoorOpen },
  { to: "/housekeeping", label: "Housekeeping", icon: Sparkles },
  { to: "/guests", label: "Guests", icon: Users },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({ children, title }: { children: ReactNode; title?: string }) {
  const { profile, signOut, isPlatformAdmin } = useAuth();
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
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}
      {isPlatformAdmin ? (
        <Link
          to="/admin"
          className="mt-2 flex items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LayoutDashboard className="size-5" />
          Platform Admin
        </Link>
      ) : null}
      <button
        onClick={() => signOut()}
        className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOut className="size-5" />
        Sign out
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-sand">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display font-bold">
            C
          </span>
          <span className="font-display text-lg font-semibold text-foreground">Custard</span>
        </div>
        {NavList}
      </aside>

      <div className="flex flex-1 flex-col">
        {/* header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="size-9">
                  <Menu className="size-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="flex h-16 items-center justify-between border-b border-border px-4">
                  <span className="font-display text-lg font-semibold text-foreground">Custard</span>
                  <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                    <X className="size-5" />
                  </Button>
                </div>
                {NavList}
              </SheetContent>
            </Sheet>
            {title ? <h1 className="text-lg font-semibold text-foreground lg:text-xl">{title}</h1> : null}
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <HotelSwitcher />
            <div className="flex items-center gap-2 border-l border-border pl-2 sm:pl-4">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(profile?.full_name ?? "")}
              </span>
              <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:inline">
                {profile?.full_name}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
