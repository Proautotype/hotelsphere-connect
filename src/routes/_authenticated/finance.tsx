import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Wallet, Receipt, Printer, Plus, ChartPie, Banknote } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getFinanceData, recordPurchase } from "@/lib/finance.functions";
import { openCashSession, closeCashSession } from "@/lib/payments.functions";
import { FOLIO_CATEGORIES } from "@/lib/permissions";
import { money, shortDate, today, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Custard Hotels" },
      { name: "description", content: "Track payments, record purchases and print receipts." },
      { property: "og:title", content: "Finance — Custard Hotels" },
      {
        property: "og:description",
        content: "Track payments, record purchases and print receipts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <DashboardShell title="Finance">
      <PageHeader
        title="Finance"
        description="We couldn't load the financial data for this hotel."
      />
      <p className="ink mt-6 bg-card p-6 text-sm">
        Try refreshing, or switch hotel from the header.
      </p>
    </DashboardShell>
  ),
  component: FinancePage,
});

interface PaymentRow {
  id: string;
  reference: string;
  receipt_number: string;
  amount: number;
  method: string;
  provider: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  booking_reference: string | null;
  guest_name: string | null;
}

interface PurchaseRow {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unit_price: number;
  amount: number;
  created_at: string;
  booking_reference: string | null;
  guest_name: string | null;
}

interface BookingOption {
  id: string;
  reference: string;
  status: string;
  balance: number;
  guest_name: string | null;
}

interface CashSession {
  id: string;
  status: string;
  opened_at: string;
  opening_balance: number;
  expected_cash: number | null;
  actual_cash: number | null;
  cashier_name: string;
}

interface FinanceHotel {
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
}

interface ExpenseRow {
  id: string;
  spent_on: string;
  category: string;
  vendor: string;
  description: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
  created_at: string;
}

interface FinanceData {
  hotel: FinanceHotel | null;
  currency: string;
  payments: PaymentRow[];
  totals: {
    received: number;
    today: number;
    outstanding: number;
    count: number;
    expenses: number;
    net: number;
  };
  openSession: CashSession | null;
  purchases: PurchaseRow[];
  purchasesTotal: number;
  bookings: BookingOption[];
  expenses: ExpenseRow[];
  expensesTotal: number;
  expensesByCategory: { category: string; amount: number }[];
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank_transfer: "Bank transfer",
  card: "Card",
};

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function htmle(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printPaymentReceipt(p: PaymentRow, hotel: FinanceHotel | null, currency: string) {
  const ref = p.receipt_number || p.reference || "";
  const when = new Date(p.paid_at ?? p.created_at).toLocaleString("en-GH");
  const method = METHOD_LABELS[p.method] ?? titleCase(p.method);
  const esc = htmle;
  const lines = [
    '<!doctype html><html><head><meta charset="utf-8" /><title>Receipt</title><style>',
    "body{font-family:ui-monospace,Menlo,Consolas,monospace;max-width:360px;margin:32px auto;color:#111}",
    "h1{font-size:18px;text-align:center;margin:0}.muted{color:#666;font-size:12px}.center{text-align:center}",
    "table{width:100%;border-collapse:collapse;margin-top:14px}th,td{text-align:left;padding:4px 6px;font-size:13px}",
    ".total{font-weight:700}.rule{border:0;border-top:1px dashed #111;margin:10px 0;width:100%}",
    "@media print{@page{margin:12mm}}</style></head><body>",
    `<div class="center"><h1>CUSTARD HOTELS</h1></div>`,
    hotel ? `<div class="center muted">${esc(hotel.name)}</div>` : "",
    hotel?.address
      ? `<div class="center muted">${esc(hotel.address)}${hotel.city ? `, ${esc(hotel.city)}` : ""}</div>`
      : "",
    hotel?.phone ? `<div class="center muted">${esc(hotel.phone)}</div>` : "",
    `<hr class="rule" />`,
    `<div><span class="muted">Receipt:</span> <strong>${esc(ref)}</strong></div>`,
    `<div><span class="muted">Date:</span> <strong>${when}</strong></div>`,
    p.booking_reference
      ? `<div><span class="muted">Booking:</span> <strong>${esc(p.booking_reference)}</strong></div>`
      : "",
    p.guest_name
      ? `<div><span class="muted">Guest:</span> <strong>${esc(p.guest_name)}</strong></div>`
      : "",
    `<div><span class="muted">Method:</span> <strong>${esc(method)} · ${esc(p.provider)}</strong></div>`,
    `<hr class="rule" />`,
    '<table><tr><th>Description</th><th style="text-align:right">Amount</th></tr>',
    `<tr><td>Payment received</td><td style="text-align:right" class="total">${money(p.amount, currency)}</td></tr>`,
    `<tr><td colspan="2" class="muted">${esc(p.reference || "")}</td></tr>`,
    `<tr><td style="text-align:right" class="total">Total paid</td><td style="text-align:right" class="total">${money(p.amount, currency)}</td></tr></table>`,
    `<hr class="rule" />`,
    `<div class="center muted">Thank you — please keep this receipt.</div>`,
    `<script>window.onload=function(){window.print();}</script></body></html>`,
  ];
  const win = window.open("", "_blank", "width=420,height=600");
  if (!win) {
    toast.error("Allow pop-ups to print the receipt");
    return;
  }
  win.document.write(lines.join(""));
  win.document.close();
}

function FinancePage() {
  const { activeHotel, can } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const currency = activeHotel?.currency ?? "GHS";
  const canView = can("finance:view");
  const canRecord = can("payments:record") || can("bookings:create");

  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(today());
  const [methodFilter, setMethodFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [openFloat, setOpenFloat] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const [purchaseBookingId, setPurchaseBookingId] = useState("");
  const [purchaseRows, setPurchaseRows] = useState([
    { id: "purchase-1", category: "food", description: "", quantity: 1, unitPrice: 0 },
  ]);

  const fetchFinance = useServerFn(getFinanceData);
  const record = useServerFn(recordPurchase);
  const openSessionFn = useServerFn(openCashSession);
  const closeSessionFn = useServerFn(closeCashSession);

  const { data, refetch } = useQuery({
    queryKey: ["finance", "overview", hotelId, from, to],
    queryFn: () => fetchFinance({ data: { hotelId, from, to } }),
    enabled: Boolean(hotelId) && canView,
  });

  const fin = data as FinanceData | undefined;

  const run = async (fnCall: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fnCall();
      toast.success(ok);
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const submitOpenSession = () =>
    run(async () => {
      await openSessionFn({ data: { hotelId, openingBalance: parseFloat(openFloat) || 0 } });
      setOpenFloat("");
    }, "Cash session opened");

  const submitCloseSession = () => {
    const session = fin?.openSession;
    if (!session) return;
    run(async () => {
      await closeSessionFn({
        data: { sessionId: session.id, actualCash: parseFloat(closeAmount) || 0 },
      });
      setCloseAmount("");
    }, "Cash session closed");
  };

  const addPurchaseRow = () =>
    setPurchaseRows((prev) => [
      ...prev,
      {
        id: `purchase-${Date.now()}-${prev.length}`,
        category: "food",
        description: "",
        quantity: 1,
        unitPrice: 0,
      },
    ]);

  const removePurchaseRow = (id: string) =>
    setPurchaseRows((prev) => prev.filter((r) => r.id !== id));

  const updatePurchaseRow = (
    id: string,
    patch: Partial<{ category: string; description: string; quantity: number; unitPrice: number }>,
  ) => setPurchaseRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseBookingId) {
      toast.error("Choose a booking to charge");
      return;
    }
    const items = purchaseRows
      .filter((r) => r.description.trim().length > 0)
      .map((r) => ({
        category: r.category,
        description: r.description.trim(),
        quantity: r.quantity,
        unitPrice: r.unitPrice,
      }));
    if (items.length === 0) {
      toast.error("Add at least one purchase line");
      return;
    }
    await run(async () => {
      await record({ data: { hotelId, bookingId: purchaseBookingId, items } });
      setPurchaseBookingId("");
      setPurchaseRows([
        {
          id: `purchase-${Date.now()}`,
          category: "food",
          description: "",
          quantity: 1,
          unitPrice: 0,
        },
      ]);
    }, "Purchase recorded on the folio");
  };

  return (
    <DashboardShell title="Finance">
      <PageHeader
        title="Finance"
        description="Track payments, record purchases and print receipts."
      />

      {!canView ? (
        <div className="mt-6">
          <EmptyState
            icon={ChartPie}
            title="Finance access required"
            description="Ask the hotel owner to grant you the View finances permission."
          />
        </div>
      ) : !fin ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading financial data…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Received (period)"
              value={money(fin.totals.received, currency)}
              icon={Wallet}
              tone="success"
              hint={`${fin.totals.count} payment(s)`}
            />
            <StatCard
              label="Received today"
              value={money(fin.totals.today, currency)}
              icon={Banknote}
              tone="accent"
            />
            <StatCard
              label="Outstanding balance"
              value={money(fin.totals.outstanding, currency)}
              icon={Receipt}
              tone="warning"
              hint="Active bookings"
            />
            <StatCard
              label="Purchases recorded"
              value={money(fin.purchasesTotal, currency)}
              icon={Plus}
              tone="primary"
              hint="Folio charges in period"
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <div className="min-w-0 space-y-6 lg:col-span-3">
              <Card>
                <CardContent className="p-5">
                  <h3 className="kinetic-label text-xs text-foreground">Payments ledger</h3>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div>
                      <Label htmlFor="fin-from">From</Label>
                      <Input
                        id="fin-from"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-to">To</Label>
                      <Input
                        id="fin-to"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="fin-method">Method</Label>
                      <select
                        id="fin-method"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={methodFilter}
                        onChange={(e) => setMethodFilter(e.target.value)}
                      >
                        <option value="all">All methods</option>
                        <option value="cash">Cash</option>
                        <option value="mobile_money">Mobile money</option>
                        <option value="bank_transfer">Bank transfer</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                    <Button onClick={() => refetch()} disabled={busy}>
                      Apply
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setFrom(daysAgoISO(30));
                        setTo(today());
                        setMethodFilter("all");
                        setQuery("");
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                  <Input
                    className="mt-2"
                    placeholder="Search receipt, booking reference or guest…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  <div className="mt-4 max-h-[460px] overflow-auto">
                    {fin.payments.length === 0 ? (
                      <EmptyState
                        icon={Receipt}
                        title="No payments"
                        description="No payments match this period or filter."
                      />
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-[2px] border-ink text-left">
                            <th className="py-2 pr-2 text-xs text-muted-foreground">Date</th>
                            <th className="py-2 pr-2 text-xs text-muted-foreground">Receipt</th>
                            <th className="py-2 pr-2 text-xs text-muted-foreground">
                              Guest / booking
                            </th>
                            <th className="py-2 pr-2 text-right text-xs text-muted-foreground">
                              Amount
                            </th>
                            <th className="py-2 pr-2 text-xs text-muted-foreground">Method</th>
                            <th className="py-2 pr-2 text-xs text-muted-foreground">Status</th>
                            <th className="py-2 text-right text-xs text-muted-foreground">
                              Receipt
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {fin.payments
                            .filter((p) => {
                              if (methodFilter !== "all" && p.method !== methodFilter) return false;
                              const q = query.toLowerCase();
                              if (!q) return true;
                              return (
                                (p.reference ?? "").toLowerCase().includes(q) ||
                                (p.receipt_number ?? "").toLowerCase().includes(q) ||
                                (p.booking_reference ?? "").toLowerCase().includes(q) ||
                                (p.guest_name ?? "").toLowerCase().includes(q)
                              );
                            })
                            .map((p) => (
                              <tr key={p.id} className="border-b border-border">
                                <td className="py-2 pr-2">
                                  {shortDate(p.paid_at ?? p.created_at)}
                                </td>
                                <td className="py-2 pr-2 font-medium">
                                  {p.receipt_number || p.reference || "—"}
                                </td>
                                <td className="py-2 pr-2">
                                  <span className="block text-foreground">
                                    {p.guest_name ?? "—"}
                                  </span>
                                  <span className="block text-xs text-muted-foreground">
                                    {p.booking_reference ?? ""}
                                  </span>
                                </td>
                                <td className="py-2 pr-2 text-right font-medium">
                                  {money(p.amount, currency)}
                                </td>
                                <td className="py-2 pr-2">
                                  {METHOD_LABELS[p.method] ?? titleCase(p.method)}
                                </td>
                                <td className="py-2 pr-2">
                                  <StatusBadge status={p.status} />
                                </td>
                                <td className="py-2 text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={p.status !== "successful"}
                                    onClick={() => printPaymentReceipt(p, fin.hotel, currency)}
                                  >
                                    <Printer className="mr-1 size-4" /> Print
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0 space-y-6 lg:col-span-2">
              <Card>
                <CardContent className="p-5">
                  <h3 className="kinetic-label text-xs text-foreground">Cash session</h3>
                  {fin.openSession ? (
                    <div className="mt-3 space-y-3 text-sm">
                      <p className="text-muted-foreground">
                        Opened {shortDate(fin.openSession.opened_at)} by{" "}
                        {fin.openSession.cashier_name}
                      </p>
                      <p>
                        Float:{" "}
                        <span className="font-medium">
                          {money(fin.openSession.opening_balance, currency)}
                        </span>
                      </p>
                      <p>
                        Expected cash:{" "}
                        <span className="font-medium">
                          {money(fin.openSession.expected_cash ?? 0, currency)}
                        </span>
                      </p>
                      {can("cash_session:manage") ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Closing cash"
                            value={closeAmount}
                            onChange={(e) => setCloseAmount(e.target.value)}
                            disabled={busy}
                          />
                          <Button size="sm" disabled={busy} onClick={submitCloseSession}>
                            Close
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-3">
                      {can("cash_session:manage") ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Opening float"
                            value={openFloat}
                            onChange={(e) => setOpenFloat(e.target.value)}
                            disabled={busy}
                          />
                          <Button size="sm" disabled={busy} onClick={submitOpenSession}>
                            Open
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No cash session is open right now.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {canRecord ? (
                <Card>
                  <CardContent className="p-5">
                    <h3 className="kinetic-label text-xs text-foreground">Record a purchase</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Post guest purchases to a booking folio.
                    </p>
                    <form onSubmit={submitPurchase} className="mt-3 space-y-3">
                      <div>
                        <Label htmlFor="purchase-booking">Booking</Label>
                        <select
                          id="purchase-booking"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={purchaseBookingId}
                          onChange={(e) => setPurchaseBookingId(e.target.value)}
                        >
                          <option value="">Select a booking…</option>
                          {fin.bookings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.reference} · {b.guest_name ?? "Guest"} · balance{" "}
                              {money(b.balance, currency)}
                            </option>
                          ))}
                        </select>
                        {fin.bookings.length === 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            No active bookings to charge.
                          </p>
                        ) : null}
                      </div>
                      {purchaseRows.map((r, idx) => (
                        <div key={r.id} className="rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium text-foreground">Item {idx + 1}</p>
                            {purchaseRows.length > 1 ? (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground underline hover:text-destructive"
                                onClick={() => removePurchaseRow(r.id)}
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-2">
                            <Label htmlFor={`purchase-cat-${r.id}`}>Category</Label>
                            <select
                              id={`purchase-cat-${r.id}`}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={r.category}
                              onChange={(e) =>
                                updatePurchaseRow(r.id, { category: e.target.value })
                              }
                            >
                              {FOLIO_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {titleCase(c)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="mt-2">
                            <Label htmlFor={`purchase-desc-${r.id}`}>Description</Label>
                            <Input
                              id={`purchase-desc-${r.id}`}
                              required
                              value={r.description}
                              onChange={(e) =>
                                updatePurchaseRow(r.id, { description: e.target.value })
                              }
                            />
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor={`purchase-qty-${r.id}`}>Qty</Label>
                              <Input
                                id={`purchase-qty-${r.id}`}
                                type="number"
                                min={1}
                                value={r.quantity}
                                onChange={(e) =>
                                  updatePurchaseRow(r.id, {
                                    quantity: parseInt(e.target.value || "1", 10),
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor={`purchase-price-${r.id}`}>Unit price</Label>
                              <Input
                                id={`purchase-price-${r.id}`}
                                type="number"
                                min={0}
                                step="0.01"
                                value={r.unitPrice}
                                onChange={(e) =>
                                  updatePurchaseRow(r.id, {
                                    unitPrice: parseFloat(e.target.value || "0"),
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        disabled={busy}
                        onClick={addPurchaseRow}
                      >
                        <Plus className="mr-1 size-4" /> Add item
                      </Button>
                      <Button type="submit" className="w-full" disabled={busy}>
                        <Plus className="mr-1 size-4" /> Record purchase
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="p-5">
                  <h3 className="kinetic-label text-xs text-foreground">Purchases & charges</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Folio charges in the selected period · {money(fin.purchasesTotal, currency)}
                  </p>
                  <div className="mt-3 max-h-[360px] overflow-auto">
                    {fin.purchases.length === 0 ? (
                      <EmptyState
                        icon={Receipt}
                        title="No purchases"
                        description="Folio charges in this period will appear here."
                      />
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-[2px] border-ink text-left">
                            <th className="py-2 pr-2 text-xs text-muted-foreground">Date</th>
                            <th className="py-2 pr-2 text-xs text-muted-foreground">Item</th>
                            <th className="py-2 pr-2 text-xs text-muted-foreground">Booking</th>
                            <th className="py-2 text-right text-xs text-muted-foreground">
                              Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {fin.purchases.map((c) => (
                            <tr key={c.id} className="border-b border-border">
                              <td className="py-2 pr-2">{shortDate(c.created_at)}</td>
                              <td className="py-2 pr-2">
                                <span className="block text-foreground">{c.description}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {titleCase(c.category)} · {c.quantity} ×{" "}
                                  {money(c.unit_price, currency)}
                                </span>
                              </td>
                              <td className="py-2 pr-2">{c.booking_reference ?? "—"}</td>
                              <td className="py-2 text-right font-medium">
                                {money(c.amount, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
