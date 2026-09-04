import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  link: string | null;
}

const FALLBACK: Record<string, string> = {
  booking: "/bookings",
  payment: "/payments",
  housekeeping: "/housekeeping",
  staff: "/staff",
  room: "/rooms",
};

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, type, is_read, created_at, link")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data ?? []) as unknown as NotificationRow[]);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const openItem = async (n: NotificationRow) => {
    setOpen(false);
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
    const to = n.link ?? FALLBACK[n.type] ?? "/dashboard";
    void navigate({ to } as never);
  };


  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) void load(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="ink relative size-9">
          <Bell className="size-5" />
          {unread > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center border-2 border-ink bg-amber text-[10px] font-extrabold text-amber-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 border-[3px] border-ink p-0">
        <div className="flex items-center justify-between border-b-[3px] border-ink px-3 py-2">
          <span className="kinetic-label text-xs text-foreground">Notifications</span>
          {unread > 0 ? (
            <button className="text-xs font-semibold text-primary hover:underline" onClick={markAllRead}>
              Mark all read
            </button>
          ) : null}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => void openItem(n)}
                className={cn(
                  "group flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-amber hover:text-amber-foreground",
                  !n.is_read && "bg-muted",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {!n.is_read ? <span className="size-2 shrink-0 bg-primary" /> : null}
                    <span className="truncate text-sm font-semibold">{n.title}</span>
                  </span>
                  <span className="block text-sm opacity-80">{n.body}</span>
                  <span className="mt-1 block text-[11px] uppercase tracking-wide opacity-70">
                    {dateTime(n.created_at)} · View
                  </span>
                </span>
                <ChevronRight className="mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-1" />
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
