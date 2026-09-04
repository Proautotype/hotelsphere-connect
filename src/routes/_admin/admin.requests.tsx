import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Database } from "lucide-react";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRequestQueues, reviewAdRequest, reviewDataRequest } from "@/lib/admin.functions";
import { money, shortDate, titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_admin/admin/requests")({
  head: () => ({
    meta: [
      { title: "Requests — Custard Hotels Admin" },
      { name: "description", content: "Review hotel advertising requests and data export or deletion requests." },
      { property: "og:title", content: "Requests — Custard Hotels Admin" },
      { property: "og:description", content: "Review hotel advertising requests and data export or deletion requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminRequestsPage,
});

function AdminRequestsPage() {
  const { isPlatformAdmin } = useAuth();
  const fetchQueues = useServerFn(getRequestQueues);
  const reviewAd = useServerFn(reviewAdRequest);
  const reviewData = useServerFn(reviewDataRequest);

  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin", "requests"], queryFn: () => fetchQueues() });
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell title="Requests">
      <PageHeader title="Requests" description="Advertising requests from hotels, and their data export or deletion requests." />

      <h2 className="mt-8 flex items-center gap-2 font-display text-xl font-semibold">
        <Megaphone className="size-5" /> Advertising
      </h2>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : (data?.ads ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={Megaphone} title="No advertising requests" description="Hotels can request to be featured from their own dashboard." />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {(data?.ads ?? []).map((ad) => (
            <Card key={ad.id}>
              <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="font-medium text-foreground">
                    {ad.hotel?.name ?? "Unknown hotel"} — {titleCase(ad.placement)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {shortDate(ad.start_date)} → {shortDate(ad.end_date)} · asked {money(ad.quoted_price, ad.hotel?.currency ?? "GHS")} ·{" "}
                    {titleCase(ad.status)}
                  </p>
                  {ad.message && <p className="mt-1 text-sm">{ad.message}</p>}
                  {ad.decision_reason && <p className="mt-1 text-sm text-muted-foreground">Note: {ad.decision_reason}</p>}
                </div>
                {isPlatformAdmin && ad.status === "pending" && (
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      className="w-28"
                      type="number"
                      step="1"
                      aria-label="Price"
                      placeholder="Price"
                      value={prices[ad.id] ?? String(Number(ad.quoted_price))}
                      onChange={(e) => setPrices((p) => ({ ...p, [ad.id]: e.target.value }))}
                    />
                    <Input
                      className="w-48"
                      aria-label="Note to the hotel"
                      placeholder="Note to the hotel"
                      value={reasons[ad.id] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [ad.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            reviewAd({
                              data: {
                                requestId: ad.id,
                                status: "approved",
                                reason: reasons[ad.id] ?? "",
                                price: Number(prices[ad.id] ?? ad.quoted_price),
                                raiseInvoice: true,
                              },
                            }),
                          "Advertising approved and invoiced",
                        )
                      }
                    >
                      Approve & invoice
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => reviewAd({ data: { requestId: ad.id, status: "declined", reason: reasons[ad.id] ?? "", raiseInvoice: false } }),
                          "Request declined",
                        )
                      }
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-10 flex items-center gap-2 font-display text-xl font-semibold">
        <Database className="size-5" /> Data requests
      </h2>
      {(data?.dataRequests ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={Database} title="No data requests" description="Hotels can ask to export or delete their own records." />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {(data?.dataRequests ?? []).map((req) => (
            <Card key={req.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {req.hotel?.name ?? "Unknown hotel"} — {titleCase(req.kind)} ({req.scope})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {titleCase(req.status)} · asked {shortDate(req.created_at)}
                  </p>
                  {req.note && <p className="mt-1 text-sm">{req.note}</p>}
                </div>
                {isPlatformAdmin && req.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void run(() => reviewData({ data: { requestId: req.id, status: "approved", note: "" } }), "Request approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void run(() => reviewData({ data: { requestId: req.id, status: "declined", note: "" } }), "Request declined")}
                    >
                      Decline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
