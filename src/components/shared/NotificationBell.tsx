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

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, type, is_read, created_at")
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
              <div key={n.id} className={cn("border-b border-border px-3 py-2.5", !n.is_read && "bg-muted")}>
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{dateTime(n.created_at)}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
