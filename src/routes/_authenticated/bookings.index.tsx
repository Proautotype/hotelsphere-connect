import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, CalendarDays, Plus, Search } from "lucide-react";
import { money, shortDate, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bookings/")({
  head: () => ({
    meta: [
      { title: "Bookings — Custard Hotels" },
      { name: "description", content: "Search bookings, stays and past guest history." },
      { property: "og:title", content: "Bookings — Custard Hotels" },
      { property: "og:description", content: "Search bookings, stays and past guest history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookingsPage,
});

interface BookingRow {
  id: string;
  reference: string;
  status: string;
  check_in: string;
  check_out: string;
  total: number;
  amount_paid: number;
  refunded_amount: number | null;
  created_at: string;
  source: string;
  channel_connection_id: string | null;
  guests: { full_name: string; phone: string | null } | null;
  rooms: { id: string; room_number: string } | null;
  room_types: { name: string } | null;
  channel_connections: {
    provider: string;
    label: string;
    status: string;
    last_sync_at: string | null;
  } | null;
}

async function fetchBookings(hotelId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, status, check_in, check_out, total, amount_paid, refunded_amount, created_at, source, channel_connection_id, guests(full_name, phone), rooms(id, room_number), room_types(name), channel_connections(provider, label, status, last_sync_at)",
    )
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BookingRow[];
}

export function channelName(row: BookingRow): string | null {
  if (!row.channel_connection_id) return null;
  const c = row.channel_connections;
  const provider = (c?.provider ?? "other").replace(/_/g, " ");
  const pretty = provider === "booking com" ? "Booking.com" : titleCase(provider);
  return c?.label ? `${pretty} · ${c.label}` : pretty;
}

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "in_house", label: "In house" },
  { key: "history", label: "History" },
  { key: "all", label: "Everything" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function bucketOf(b: BookingRow): TabKey {
  if (b.status === "checked_in") return "in_house";
  if (["checked_out", "cancelled", "no_show"].includes(b.status)) return "history";
  return "upcoming";
}

function BookingsPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", "list", hotelId],
    queryFn: () => fetchBookings(hotelId),
    enabled: Boolean(hotelId),
  });

  const [tab, setTab] = useState<TabKey>("upcoming");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const counts = useMemo(() => {
    const base: Record<TabKey, number> = { upcoming: 0, in_house: 0, history: 0, all: 0 };
    bookings.forEach((b) => {
      base[bucketOf(b)] += 1;
      base.all += 1;
    });
    return base;
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
      if (tab !== "all" && bucketOf(b) !== tab) return false;
      if (from && b.check_out < from) return false;
      if (to && b.check_in > to) return false;
      if (!q) return true;
      return [
        b.reference,
        b.guests?.full_name ?? "",
        b.guests?.phone ?? "",
        b.rooms?.room_number ?? "",
        b.room_types?.name ?? "",
        b.status.replace(/_/g, " "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [bookings, tab, query, from, to]);

  return (
    <DashboardShell title="Bookings">
      <PageHeader
        title="Bookings"
        description="Search every reservation — upcoming stays, guests in house, and past history."
        actions={
          <Button asChild>
            <Link to="/bookings/$id" params={{ id: "new" }}>
              <Plus className="mr-1 size-4" /> New booking
            </Link>
          </Button>
        }
      />

      <div className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className="ml-1 opacity-70">{counts[t.key]}</span>
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_150px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search reference, guest, phone, room…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Input
            type="date"
            aria-label="Stays from"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
          <Input
            type="date"
            aria-label="Stays until"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {(query || from || to) && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {filtered.length} match{filtered.length === 1 ? "" : "es"}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setQuery("");
                setFrom("");
                setTo("");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={bookings.length === 0 ? "No bookings yet" : "Nothing matches that search"}
            description={
              bookings.length === 0
                ? "Create a reservation to get started."
                : "Try another name, reference or date range."
            }
            action={
              <Button asChild>
                <Link to="/bookings/$id" params={{ id: "new" }}>
                  Create booking
                </Link>
              </Button>
            }
          />
        ) : (
          filtered.map((b) => {
            const balance = Number(b.total) - Number(b.amount_paid);
            const stayed = b.status === "checked_out";
            return (
              <Link key={b.id} to="/bookings/$id" params={{ id: b.id }} className="block">
                <Card className="group transition-all hover:-translate-y-0.5 hover:bg-amber hover:text-amber-foreground hover:shadow-hard">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{b.reference}</span>
                        <StatusBadge status={b.status} />
                        {b.check_in === today() && b.status === "confirmed" && (
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            arriving today
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm opacity-80">
                        {b.guests?.full_name} · {b.room_types?.name}{" "}
                        {b.rooms?.room_number ? `· Room ${b.rooms.room_number}` : ""}
                      </p>
                      <p className="text-xs opacity-70">
                        {shortDate(b.check_in)} → {shortDate(b.check_out)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 sm:text-right">
                      <div>
                        <p className="font-medium">{money(b.total, activeHotel?.currency)}</p>
                        {balance > 0.009 && (
                          <p className="text-xs font-semibold">
                            Balance {money(balance, activeHotel?.currency)}
                          </p>
                        )}
                        {Number(b.refunded_amount ?? 0) > 0.009 && (
                          <p className="text-xs opacity-80">
                            Refunded {money(b.refunded_amount ?? 0, activeHotel?.currency)}
                          </p>
                        )}
                        <p className="kinetic-label mt-1 text-[10px] opacity-70">
                          {stayed ? "View history" : "Open booking"}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </DashboardShell>
  );
}
