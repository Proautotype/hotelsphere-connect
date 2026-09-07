import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { openCashSession, closeCashSession } from "@/lib/payments.functions";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CreditCard } from "lucide-react";
import { money, shortDate } from "@/lib/format";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — Custard Hotels" },
      { name: "description", content: "View payments and manage cash sessions." },
      { property: "og:title", content: "Payments — Custard Hotels" },
      { property: "og:description", content: "View payments and manage cash sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <DashboardShell title="Payments">
      <PageHeader title="Payments" description="We couldn't load payments for this hotel." />
      <p className="ink mt-6 bg-card p-6 text-sm">Try refreshing, or switch hotel from the header.</p>
    </DashboardShell>
  ),
  component: PaymentsPage,
});

async function fetchPayments(hotelId: string) {
  const { data, error } = await supabase
    .from("payments")
    .select("*, bookings(reference), guests(full_name)")
    .eq("hotel_id", hotelId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchOpenCashSession(hotelId: string) {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("hotel_id", hotelId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

function PaymentsPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", "list", hotelId],
    queryFn: () => fetchPayments(hotelId),
    enabled: Boolean(hotelId),
  });
  const { data: openSession, refetch } = useQuery({
    queryKey: ["cash-session", "open", hotelId],
    queryFn: () => fetchOpenCashSession(hotelId),
    enabled: Boolean(hotelId),
  });
  const [busy, setBusy] = useState<"open" | "close" | null>(null);
  const [floatAmount, setFloatAmount] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const open = useServerFn(openCashSession);
  const close = useServerFn(closeCashSession);


  const handleOpen = async () => {
    if (!activeHotel || busy) return;
    setBusy("open");
    try {
      await open({ data: { hotelId: activeHotel.id, openingBalance: parseFloat(floatAmount) || 0 } });
      toast.success("Cash session opened");
      setFloatAmount("");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open session");
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async () => {
    if (!openSession || busy) return;
    setBusy("close");
    try {
        await close({ data: { sessionId: openSession.id, actualCash: parseFloat(closeAmount) || 0 } });
      toast.success("Cash session closed");
      setCloseAmount("");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close session");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DashboardShell title="Payments">
      <PageHeader title="Payments" description="Transactions and cash session management." />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium text-foreground">Cash session</h3>
            {openSession ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">Opened at {shortDate(openSession.opened_at)}</p>
                <p className="text-sm">Float: {money(openSession.opening_balance, activeHotel?.currency)}</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="w-32 rounded-md border border-input px-3 py-2 text-sm"
                    placeholder="Close float"
                    value={closeAmount}
                    onChange={(e) => setCloseAmount(e.target.value)}
                  />
                  <Button size="sm" disabled={busy !== null} onClick={handleClose}>{busy === "close" ? "Closing…" : "Close session"}</Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number"
                  className="w-32 rounded-md border border-input px-3 py-2 text-sm"
                  placeholder="Open float"
                  value={floatAmount}
                  onChange={(e) => setFloatAmount(e.target.value)}
                />
                <Button size="sm" disabled={busy !== null} onClick={handleOpen}>{busy === "open" ? "Opening…" : "Open session"}</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <h3 className="font-medium text-foreground">Recent payments</h3>
            {payments.length === 0 ? (
              <EmptyState icon={CreditCard} title="No payments yet" description="Payments appear once bookings are settled." />
            ) : (
              <div className="mt-3 space-y-2">
                {(payments as Array<{ id: string; amount: number; method: string; status: string; bookings: unknown; guests: unknown }>).map((p) => {
                  const booking = p.bookings as unknown as { reference: string } | null;
                  const guest = p.guests as unknown as { full_name: string } | null;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{money(p.amount, activeHotel?.currency)} · {p.method}</p>
                        <p className="text-xs text-muted-foreground">{booking?.reference} · {guest?.full_name}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
