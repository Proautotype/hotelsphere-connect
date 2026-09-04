import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { AdminShell } from "@/components/shared/AdminShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBillingOverview, savePlan, setPlatformFees, setHotelSubscription, createInvoice, setInvoiceStatus } from "@/lib/admin.functions";
import { money, shortDate, titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_admin/admin/plans")({
  head: () => ({
    meta: [
      { title: "Plans & billing — Custard Hotels Admin" },
      { name: "description", content: "Set hotel subscription plans, joining fees, commission rates and raise invoices." },
      { property: "og:title", content: "Plans & billing — Custard Hotels Admin" },
      { property: "og:description", content: "Set hotel subscription plans, joining fees, commission rates and raise invoices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPlansPage,
});

const PERIODS = ["monthly", "quarterly", "annually"] as const;

function AdminPlansPage() {
  const { isPlatformAdmin } = useAuth();
  const fetchOverview = useServerFn(getBillingOverview);
  const savePlanFn = useServerFn(savePlan);
  const saveFees = useServerFn(setPlatformFees);
  const saveSub = useServerFn(setHotelSubscription);
  const raiseInvoice = useServerFn(createInvoice);
  const markInvoice = useServerFn(setInvoiceStatus);

  const { data, refetch, isLoading } = useQuery({ queryKey: ["admin", "billing"], queryFn: () => fetchOverview() });
  const [busy, setBusy] = useState(false);

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

  const settings = data?.settings;

  return (
    <AdminShell title="Plans & billing">
      <PageHeader title="Plans & billing" description="Subscription plans, joining fees, commission and hotel invoices." />

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Platform defaults */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="kinetic-label text-xs text-foreground">Platform defaults</h3>
              <form
                className="mt-4 grid gap-4 sm:grid-cols-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void run(
                    () =>
                      saveFees({
                        data: {
                          commissionPercent: Number(f.get("commission")),
                          registrationFee: Number(f.get("regfee")),
                          adPriceHomeFeatured: Number(f.get("home")),
                          adPriceSearchTop: Number(f.get("search")),
                          adPriceBanner: Number(f.get("banner")),
                        },
                      }),
                    "Platform defaults saved",
                  );
                }}
              >
                <div>
                  <Label htmlFor="commission">Commission %</Label>
                  <Input id="commission" name="commission" type="number" step="0.1" defaultValue={Number(settings?.commission_percent ?? 0)} />
                </div>
                <div>
                  <Label htmlFor="regfee">Joining fee</Label>
                  <Input id="regfee" name="regfee" type="number" step="1" defaultValue={Number(settings?.registration_fee ?? 0)} />
                </div>
                <div>
                  <Label htmlFor="home">Home feature price</Label>
                  <Input id="home" name="home" type="number" step="1" defaultValue={Number(settings?.ad_price_home_featured ?? 0)} />
                </div>
                <div>
                  <Label htmlFor="search">Top of search price</Label>
                  <Input id="search" name="search" type="number" step="1" defaultValue={Number(settings?.ad_price_search_top ?? 0)} />
                </div>
                <div>
                  <Label htmlFor="banner">Banner price</Label>
                  <Input id="banner" name="banner" type="number" step="1" defaultValue={Number(settings?.ad_price_banner ?? 0)} />
                </div>
                <div className="sm:col-span-5">
                  <Button type="submit" disabled={busy || !isPlatformAdmin}>
                    Save defaults
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Plans */}
          <h2 className="mt-10 font-display text-xl font-semibold">Plans</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {(data?.plans ?? []).map((plan) => (
              <Card key={plan.id}>
                <CardContent className="p-6">
                  <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                    <span className="kinetic-label text-[10px] text-muted-foreground">{titleCase(plan.billing_period)}</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">{money(plan.price)}</p>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <dl className="mt-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Joining fee</dt>
                      <dd>{money(plan.registration_fee)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Commission</dt>
                      <dd>{Number(plan.commission_percent)}%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Room limit</dt>
                      <dd>{plan.max_rooms ?? "Unlimited"}</dd>
                    </div>
                  </dl>
                  <form
                    className="mt-4 grid gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(
                        () =>
                          savePlanFn({
                            data: {
                              id: plan.id,
                              name: plan.name,
                              slug: plan.slug,
                              description: plan.description,
                              billingPeriod: plan.billing_period as (typeof PERIODS)[number],
                              price: Number(f.get("price")),
                              registrationFee: Number(f.get("fee")),
                              commissionPercent: Number(f.get("comm")),
                              maxRooms: plan.max_rooms,
                              features: plan.features,
                              isActive: plan.is_active,
                            },
                          }),
                        `${plan.name} updated`,
                      );
                    }}
                  >
                    <div className="grid grid-cols-3 gap-2">
                      <Input name="price" type="number" step="1" defaultValue={Number(plan.price)} aria-label="Price" />
                      <Input name="fee" type="number" step="1" defaultValue={Number(plan.registration_fee)} aria-label="Joining fee" />
                      <Input name="comm" type="number" step="0.1" defaultValue={Number(plan.commission_percent)} aria-label="Commission" />
                    </div>
                    <Button type="submit" size="sm" variant="secondary" disabled={busy || !isPlatformAdmin}>
                      Update price / fee / commission
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Hotels */}
          <h2 className="mt-10 font-display text-xl font-semibold">Hotels</h2>
          <div className="mt-4 space-y-3">
            {(data?.hotels ?? []).map((hotel) => (
              <Card key={hotel.id}>
                <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
                  <div>
                    <p className="font-medium text-foreground">{hotel.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {hotel.city} · {hotel.room_count} rooms · {titleCase(hotel.status)}
                    </p>
                    <p className="mt-1 text-sm">
                      Online revenue {money(hotel.onlineRevenue, hotel.currency)} · commission {money(hotel.commissionOwed, hotel.currency)} ·
                      unpaid {money(hotel.outstanding, hotel.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Plan: {(data?.plans ?? []).find((p) => p.id === hotel.subscription?.plan_id)?.name ?? "None"} ·{" "}
                      {titleCase(hotel.subscription?.status ?? "none")} · renews{" "}
                      {hotel.subscription?.current_period_end ? shortDate(hotel.subscription.current_period_end) : "—"} · joining fee{" "}
                      {hotel.subscription?.registration_fee_paid ? "paid" : "unpaid"}
                    </p>
                  </div>
                  {isPlatformAdmin && (
                    <div className="flex flex-wrap items-end gap-2">
                      <Select
                        onValueChange={(planId) => void run(() => saveSub({ data: { hotelId: hotel.id, planId } }), "Plan updated")}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Set plan" />
                        </SelectTrigger>
                        <SelectContent>
                          {(data?.plans ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        onValueChange={(status) =>
                          void run(
                            () => saveSub({ data: { hotelId: hotel.id, status: status as "trial" | "active" | "past_due" | "cancelled" } }),
                            "Status updated",
                          )
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Set status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="past_due">Past due</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () =>
                              saveSub({
                                data: { hotelId: hotel.id, registrationFeePaid: !hotel.subscription?.registration_fee_paid },
                              }),
                            "Joining fee updated",
                          )
                        }
                      >
                        {hotel.subscription?.registration_fee_paid ? "Mark fee unpaid" : "Mark fee paid"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          const plan = (data?.plans ?? []).find((p) => p.id === hotel.subscription?.plan_id);
                          void run(
                            () =>
                              raiseInvoice({
                                data: {
                                  hotelId: hotel.id,
                                  kind: "subscription",
                                  description: `${plan?.name ?? "Subscription"} (${titleCase(plan?.billing_period ?? "")})`,
                                  amount: Number(plan?.price ?? 0),
                                },
                              }),
                            "Invoice raised",
                          );
                        }}
                      >
                        Raise subscription invoice
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy || hotel.commissionOwed <= 0}
                        onClick={() =>
                          void run(
                            () =>
                              raiseInvoice({
                                data: {
                                  hotelId: hotel.id,
                                  kind: "commission",
                                  description: "Commission on online bookings",
                                  amount: Number(hotel.commissionOwed.toFixed(2)),
                                },
                              }),
                            "Commission invoice raised",
                          )
                        }
                      >
                        Invoice commission
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Invoices */}
          <h2 className="mt-10 font-display text-xl font-semibold">Invoices</h2>
          {(data?.invoices ?? []).length === 0 ? (
            <Card className="mt-4">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <Receipt className="size-4" /> No invoices raised yet.
              </CardContent>
            </Card>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-ink text-left">
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">Number</th>
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">Hotel</th>
                    <th className="kinetic-label pb-2 text-[10px] text-muted-foreground">For</th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">Amount</th>
                    <th className="kinetic-label pb-2 text-right text-[10px] text-muted-foreground">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(data?.invoices ?? []).map((inv) => (
                    <tr key={inv.id} className="border-b border-border">
                      <td className="py-2 font-medium text-foreground">{inv.number}</td>
                      <td className="py-2 text-muted-foreground">{(data?.hotels ?? []).find((h) => h.id === inv.hotel_id)?.name ?? "—"}</td>
                      <td className="py-2 text-muted-foreground">{inv.description || titleCase(inv.kind)}</td>
                      <td className="py-2 text-right">{money(inv.amount, inv.currency)}</td>
                      <td className="py-2 text-right">{titleCase(inv.status)}</td>
                      <td className="py-2 text-right">
                        {isPlatformAdmin && inv.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void run(() => markInvoice({ data: { invoiceId: inv.id, status: "paid" } }), "Marked paid")}
                          >
                            Mark paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
