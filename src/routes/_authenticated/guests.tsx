import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/guests")({
  head: () => ({
    meta: [
      { title: "Guests — Custard Hotels" },
      { name: "description", content: "Guest directory and history." },
      { property: "og:title", content: "Guests — Custard Hotels" },
      { property: "og:description", content: "Guest directory and history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestsPage,
});

async function fetchGuests(hotelId: string) {
  const { data, error } = await supabase
    .from("guests")
    .select("*")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

function GuestsPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const { data: guests = [] } = useQuery({
    queryKey: ["guests", "list", hotelId],
    queryFn: () => fetchGuests(hotelId),
    enabled: Boolean(hotelId),
  });
  const [query, setQuery] = useState("");

  const filtered = (guests as Array<{ id: string; full_name: string; email: string | null; phone: string | null; country: string | null; id_type: string | null; id_number: string | null }>).filter((g) =>
    g.full_name.toLowerCase().includes(query.toLowerCase()) ||
    (g.email ?? "").toLowerCase().includes(query.toLowerCase()) ||
    (g.phone ?? "").includes(query),
  );

  return (
    <DashboardShell title="Guests">
      <PageHeader title="Guests" description="Search returning guests and view their history." />

      <div className="mt-6">
        <Input
          placeholder="Search by name, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No guests found" description="Guests are created when you make a booking." />
        ) : (
          filtered.map((g: { id: string; full_name: string; email: string | null; phone: string | null; country: string | null; id_type: string | null; id_number: string | null }) => (
            <Card key={g.id}>
              <CardContent className="p-4">
                <p className="font-medium text-foreground">{g.full_name}</p>
                <p className="text-sm text-muted-foreground">{g.email} · {g.phone}</p>
                <p className="text-xs text-muted-foreground">{g.country} {g.id_number ? `· ${g.id_type} ${g.id_number}` : ""}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
