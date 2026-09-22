import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  checkInStudentAllocation,
  createAllocationOffer,
  listAllocationsForHotel,
  listPublishedRequests,
  withdrawAllocationOffer,
} from "@/lib/controller.functions";
import { GraduationCap } from "lucide-react";
import { money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/allocations")({
  head: () => ({
    meta: [
      { title: "Schools & allocations — Custard Hotels" },
      { name: "description", content: "Offer beds to schools and check their students in." },
    ],
  }),
  component: AllocationsPage,
});

async function fetchRooms(hotelId: string) {
  const { data } = await supabase
    .from("rooms")
    .select("id, room_number, status, room_types(name, max_guests, pricing_model)")
    .eq("hotel_id", hotelId)
    .order("room_number", { ascending: true });
  return (data ?? []) as unknown as {
    id: string;
    room_number: string;
    status: string;
    room_types: { name: string; max_guests: number; pricing_model: string } | null;
  }[];
}

function AllocationsPage() {
  const { activeHotel } = useAuth();
  const hotelId = activeHotel?.id ?? "";
  const queryClient = useQueryClient();

  const getRequests = useServerFn(listPublishedRequests);
  const getAllocations = useServerFn(listAllocationsForHotel);
  const sendOffer = useServerFn(createAllocationOffer);
  const withdraw = useServerFn(withdrawAllocationOffer);
  const checkIn = useServerFn(checkInStudentAllocation);

  const [busy, setBusy] = useState(false);
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({ beds: "", price: "", notes: "" });
  const [checkInFor, setCheckInFor] = useState<string | null>(null);
  const [checkInForm, setCheckInForm] = useState({ roomId: "", bedNumber: "" });

  const { data: requests = [] } = useQuery({
    queryKey: ["allocations", "requests", hotelId],
    queryFn: () => getRequests({ data: { hotelId } }),
    enabled: Boolean(hotelId),
  });
  const { data: allocations = [] } = useQuery({
    queryKey: ["allocations", "students", hotelId],
    queryFn: () => getAllocations({ data: { hotelId } }),
    enabled: Boolean(hotelId),
  });
  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", "list", hotelId],
    queryFn: () => fetchRooms(hotelId),
    enabled: Boolean(hotelId),
  });

  // Default to the first room that can actually take a student.
  useEffect(() => {
    if (!checkInFor || checkInForm.roomId) return;
    const first = rooms.find((r) => r.status !== "out_of_service" && r.status !== "maintenance");
    if (first) setCheckInForm((p) => ({ ...p, roomId: first.id }));
  }, [checkInFor, checkInForm.roomId, rooms]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["allocations"] });
    await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    await queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const confirmed = allocations.filter((a) => a.status === "confirmed");
  const livingHere = allocations.filter((a) => a.status === "checked_in");

  const submitOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerFor) return;
    void run("Offer sent to the school", async () => {
      await sendOffer({
        data: {
          hotelId,
          requestId: offerFor,
          bedsAvailable: parseInt(offerForm.beds || "0", 10),
          pricePerStudent: parseFloat(offerForm.price || "0"),
          notes: offerForm.notes.trim(),
        },
      });
      setOfferForm({ beds: "", price: "", notes: "" });
      setOfferFor(null);
    });
  };

  const submitCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInFor || !checkInForm.roomId) return;
    void run("Student checked in", async () => {
      await checkIn({
        data: {
          allocationId: checkInFor,
          roomId: checkInForm.roomId,
          bedNumber: checkInForm.bedNumber.trim() || undefined,
        },
      });
      setCheckInForm({ roomId: "", bedNumber: "" });
      setCheckInFor(null);
    });
  };

  const studentName = (a: (typeof allocations)[number]) =>
    (a.students as unknown as { full_name: string } | null)?.full_name ?? "Student";

  return (
    <DashboardShell title="Schools & allocations">
      <PageHeader
        title="Schools & allocations"
        description="Offer beds to schools looking for student accommodation, then check their students in."
      />

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="kinetic-label text-xs text-foreground">Open requests from schools</h3>
          {requests.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No school is looking for beds right now.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="ink flex flex-col gap-3 bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-sm font-extrabold tracking-tight">
                        {r.title}
                      </p>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {r.school?.name ?? "A school"} · {r.students_count} students ·{" "}
                      {r.preferred_city || "any town"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.period_start ? shortDate(r.period_start) : "No start date"} →{" "}
                      {r.period_end ? shortDate(r.period_end) : "open-ended"}
                      {r.budget_per_student
                        ? ` · budget ${money(r.budget_per_student, activeHotel?.currency)} each`
                        : ""}
                    </p>
                    {r.notes ? (
                      <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    {r.myOffer ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          You offered {r.myOffer.beds_available} beds at{" "}
                          {money(r.myOffer.price_per_student, activeHotel?.currency)}
                        </p>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.myOffer.status} />
                          {r.myOffer.status === "offered" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                run("Offer withdrawn", () =>
                                  withdraw({ data: { offerId: r.myOffer!.id } }),
                                )
                              }
                            >
                              Withdraw
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => setOfferFor(r.id)}>
                        Offer beds
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="kinetic-label text-xs text-foreground">Students to check in</h3>
          {confirmed.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nobody is waiting to move in. Students appear here once a school accepts your offer
              and assigns them.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {confirmed.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{studentName(a)}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.school?.name ?? "School"} · {a.request?.title ?? "—"}
                      {a.price ? ` · ${money(a.price, activeHotel?.currency)}` : ""}
                    </p>
                  </div>
                  <Button size="sm" disabled={busy} onClick={() => setCheckInFor(a.id)}>
                    Check in
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6">
          <h3 className="kinetic-label text-xs text-foreground">Students living here</h3>
          {livingHere.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No students in residence"
              description="Once you check a student in, their stay appears here and on the bookings list."
            />
          ) : (
            <div className="mt-3 space-y-1">
              {livingHere.map((a) => {
                const room = a.rooms as unknown as { room_number: string } | null;
                return (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0"
                  >
                    <span className="text-foreground">{studentName(a)}</span>
                    <span className="text-xs text-muted-foreground">
                      {room?.room_number ? `Room ${room.room_number}` : "No room"}
                      {a.bed_number ? ` · Bed ${a.bed_number}` : ""} · {a.school?.name ?? "School"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={offerFor !== null} onOpenChange={(v) => !v && setOfferFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Offer beds to this school</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitOffer} className="space-y-4">
            <div>
              <Label htmlFor="of-beds">Beds you can hold</Label>
              <Input
                id="of-beds"
                type="number"
                min={1}
                required
                value={offerForm.beds}
                onChange={(e) => setOfferForm((p) => ({ ...p, beds: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="of-price">Price per student, for the whole stay</Label>
              <Input
                id="of-price"
                type="number"
                min={0}
                step="0.01"
                required
                value={offerForm.price}
                onChange={(e) => setOfferForm((p) => ({ ...p, price: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="of-notes">Notes</Label>
              <Textarea
                id="of-notes"
                rows={3}
                placeholder="4-bed dorms, 10 minutes from campus, water and WiFi included."
                value={offerForm.notes}
                onChange={(e) => setOfferForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send offer"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={checkInFor !== null} onOpenChange={(v) => !v && setCheckInFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Check this student in</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCheckIn} className="space-y-4">
            <div>
              <Label htmlFor="ci-room">Room</Label>
              <select
                id="ci-room"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={checkInForm.roomId}
                onChange={(e) => setCheckInForm((p) => ({ ...p, roomId: e.target.value }))}
                required
              >
                <option value="">Choose a room…</option>
                {rooms
                  .filter((r) => r.status !== "out_of_service" && r.status !== "maintenance")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.room_number}
                      {r.room_types ? ` · ${r.room_types.name}` : ""}
                      {r.room_types ? ` · sleeps ${r.room_types.max_guests}` : ""}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label htmlFor="ci-bed">Bed (optional)</Label>
              <Input
                id="ci-bed"
                placeholder="A"
                value={checkInForm.bedNumber}
                onChange={(e) => setCheckInForm((p) => ({ ...p, bedNumber: e.target.value }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This creates a semester stay on the room and adds the student as an occupant. Others
              already in that room join the same stay.
            </p>
            <Button type="submit" disabled={busy || !checkInForm.roomId}>
              {busy ? "Working…" : "Check in"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
