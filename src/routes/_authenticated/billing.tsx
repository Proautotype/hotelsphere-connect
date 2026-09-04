import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Receipt, Download } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getHotelBilling, requestAdPlacement, requestDataAction, exportHotelData } from "@/lib/billing.functions";
import { money, shortDate, titleCase, today } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Plan, invoices & promotion — Custard Hotels" },
      { name: "description", content: "See your Custard Hotels plan, invoices and commission, request promotion, and export your hotel data." },
      { property: "og:title", content: "Plan, invoices & promotion — Custard Hotels" },
      { property: "og:description", content: "See your plan, invoices and commission, request promotion, and export your hotel data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HotelBillingPage,
});

const PLACEMENTS = [
  { value: "home_featured", label: "Featured on the home page" },
  { value: "search_top", label: "Top of search results" },
  { value: "banner", label: "Banner across discovery" },
] as const;

function HotelBillingPage() {
  const { activeHotel, can } = useAuth();
  const fetchBilling = useServerFn(getHotelBilling);
  const askForAd = useServerFn(requestAdPlacement);
  const askForData = useServerFn(requestDataAction);
  const exportData = useServerFn(exportHotelData);

  const hotelId = activeHotel?.id;
  const currency = activeHotel?.currency ?? "GHS";

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["hotel", "billing", hotelId],
    queryFn: () => fetchBilling({ data: { hotelId: hotelId! } }),
    enabled: Boolean(hotelId),
  });

  const [busy, setBusy] = useState(false);
  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]["value"]>("home_featured");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [message, setMessage] = useState("");

  const plan = (data?.plans ?? []).find((p) => p.id === data?.subscription?.plan_id);
  const adPrice = (p: string) =>
    p === "home_featured"
      ? Number(data?.settings?.ad_price_home_featured ?? 0)
      : p === "search_top"
        ? Number(data?.settings?.ad_price_search_top ?? 0)
        : Number(data?.settings?.ad_price_banner ?? 0);

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

  const download = async (dataset: "bookings" | "guests" | "payments" | "folio_items") => {
    setBusy(true);
    try {
      const res = await exportData({ data: { hotelId: hotelId!, dataset } });
      if (!res.csv) {
        toast.info("Nothing to export yet");
        return;
      }
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${res.count} rows downloaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  if (!can("billing:view")) {
    return (
      <DashboardShell title="Plan & billing">
        <PageHeader title="Plan & billing" description="Only the hotel owner or a hotel admin can see this." />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Plan & billing">
      <PageHeader title="Plan, invoices & promotion" description="What you pay Custard Hotels, and how to get more visibility." />

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h3 className="kinetic-label text-xs text-foreground">Your plan</h3>
                <p className="mt-2 font-display text-2xl font-semibold">{plan?.name ?? "No plan yet"}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Billing</dt>
                    <dd>{plan ? `${money(plan.price, currency)} ${titleCase(plan.billing_period)}` : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{titleCase(data?.subscription?.status ?? "none")}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Renews</dt>
                    <dd>{data?.subscription?.current_period_end ? shortDate(data.subscription.current_period_end) : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Joining fee</dt>
                    <dd>{data?.subscription?.registration_fee_paid ? "Paid" : money(plan?.registration_fee ?? 0, currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Commission on online bookings</dt>
                    <dd>
                      {Number(
                        data?.subscription?.commission_percent_override ?? plan?.commission_percent ?? data?.settings?.commission_percent ?? 0,
                      )}
                      %
                    </dd>
                  </div>
                  <div className="flex justify-between border-t-2 border-ink pt-2 font-medium">
                    <dt>Outstanding</dt>
                    <dd>{money(data?.outstanding ?? 0, currency)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="kinetic-label flex items-center gap-2 text-xs text-foreground">
                  <Megaphone className="size-4" /> Ask to be promoted
                </h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label htmlFor="placement">Where</Label>
                    <Select value={placement} onValueChange={(v) => setPlacement(v as typeof placement)}>
                      <SelectTrigger id="placement">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PLACEMENTS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label} — {money(adPrice(p.value), currency)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="ad-start">From</Label>
                      <Input id="ad-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="ad-end">Until</Label>
                      <Input id="ad-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="ad-message">Anything we should know?</Label>
                    <Textarea id="ad-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} />
                  </div>
                  <Button
                    disabled={busy || !hotelId}
                    onClick={() =>
                      void run(
                        () => askForAd({ data: { hotelId: hotelId!, placement, startDate, endDate, message } }),
                        "Request sent for review",
                      ).then(() => setMessage(""))
                    }
                  >
                    Send request
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {(data?.ads ?? []).length > 0 && (
            <Card className="mt-6">
              <CardContent className="p-6">
                <h3 className="kinetic-label text-xs text-foreground">Your promotion requests</h3>
                <div className="mt-3 space-y-2 text-sm">
                  {(data?.ads ?? []).map((ad) => (
                    <div key={ad.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                      <span>
                        {titleCase(ad.placement)} · {shortDate(ad.start_date)} → {shortDate(ad.end_date)}
                      </span>
                      <span className="text-muted-foreground">
                        {money(ad.quoted_price, currency)} · {titleCase(ad.status)}
                        {ad.decision_reason ? ` — ${ad.decision_reason}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="kinetic-label flex items-center gap-2 text-xs text-foreground">
                <Receipt className="size-4" /> Invoices
              </h3>
              {(data?.invoices ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">No charges yet.</p>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  {(data?.invoices ?? []).map((inv) => (
                    <div key={inv.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                      <span>
                        <strong className="font-medium">{inv.number}</strong> · {inv.description || titleCase(inv.kind)}
                      </span>
                      <span className="text-muted-foreground">
                        {money(inv.amount, inv.currency)} · {titleCase(inv.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {can("data:manage") && (
            <Card className="mt-6">
              <CardContent className="p-6">
                <h3 className="kinetic-label flex items-center gap-2 text-xs text-foreground">
                  <Download className="size-4" /> Your data
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">Download your own records at any time, or ask us to remove them.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["bookings", "guests", "payments", "folio_items"] as const).map((ds) => (
                    <Button key={ds} size="sm" variant="secondary" disabled={busy} onClick={() => void download(ds)}>
                      Download {ds.replace("_", " ")}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || !hotelId}
                    onClick={() =>
                      void run(
                        () => askForData({ data: { hotelId: hotelId!, kind: "delete", scope: "all", note: "" } }),
                        "Deletion request sent for review",
                      )
                    }
                  >
                    Request data deletion
                  </Button>
                </div>
                {(data?.dataRequests ?? []).length > 0 && (
                  <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                    {(data?.dataRequests ?? []).map((r) => (
                      <p key={r.id}>
                        {titleCase(r.kind)} ({r.scope}) — {titleCase(r.status)} {r.response_note ? `· ${r.response_note}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </DashboardShell>
  );
}
