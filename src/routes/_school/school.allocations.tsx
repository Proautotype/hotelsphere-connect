import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ControllerShell } from "@/components/shared/ControllerShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  listPlaceableHostels,
  listSchoolAllocations,
  listStudents,
  placeStudents,
  unplaceStudent,
} from "@/lib/controller.functions";
import { GraduationCap } from "lucide-react";
import { money, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_school/school/allocations")({
  head: () => ({
    meta: [
      { title: "Placements — Custard Hotels" },
      { name: "description", content: "Where your students are staying." },
    ],
  }),
  component: PlacementsPage,
});

function PlacementsPage() {
  const { activeController } = useAuth();
  const controllerId = activeController?.id ?? "";
  const queryClient = useQueryClient();

  const getAllocations = useServerFn(listSchoolAllocations);
  const getStudents = useServerFn(listStudents);
  const getHostels = useServerFn(listPlaceableHostels);
  const place = useServerFn(placeStudents);
  const unplace = useServerFn(unplaceStudent);

  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [hotelId, setHotelId] = useState("");
  const [price, setPrice] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const { data: allocations = [] } = useQuery({
    queryKey: ["school", "allocations", controllerId],
    queryFn: () => getAllocations({ data: { controllerId } }),
    enabled: Boolean(controllerId),
  });
  const { data: students = [] } = useQuery({
    queryKey: ["school", "students", controllerId],
    queryFn: () => getStudents({ data: { controllerId } }),
    enabled: Boolean(controllerId),
  });
  const { data: hostels = [] } = useQuery({
    queryKey: ["school", "placeable-hostels", controllerId],
    queryFn: () => getHostels({ data: { controllerId } }),
    enabled: Boolean(controllerId) && open,
  });

  // A student already living somewhere cannot be placed again.
  const placedIds = new Set(allocations.map((a) => a.student_id));
  const unplaced = students.filter((s) => !placedIds.has(s.id));
  const selectedHostel = hostels.find((h) => h.id === hotelId) ?? null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["school"] });
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId || picked.length === 0) return;
    void run(`${picked.length} student(s) placed`, async () => {
      await place({
        data: {
          controllerId,
          hotelId,
          studentIds: picked,
          price: price ? parseFloat(price) : null,
        },
      });
      setPicked([]);
      setPrice("");
      setHotelId("");
      setOpen(false);
    });
  };

  return (
    <ControllerShell title="Placements">
      <PageHeader
        title="Placements"
        description="Where your students are staying. Place them directly, or accept a hostel's offer on an accommodation request."
        actions={
          <Button onClick={() => setOpen(true)} disabled={students.length === 0}>
            Place students
          </Button>
        }
      />

      {students.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={GraduationCap}
            title="No students on your register yet"
            description="Add students first, then place them into a hostel."
          />
          <div className="mt-4 flex justify-center">
            <Button asChild variant="outline">
              <Link to="/school/students">Add students</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {allocations.length} placed · {unplaced.length} still to place
          </p>

          <div className="mt-3 space-y-2">
            {allocations.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Nobody is placed yet"
                description="Choose a hostel and put your students in it."
              />
            ) : (
              allocations.map((a) => {
                const student = a.students as unknown as {
                  full_name: string;
                  student_ref: string;
                  program: string;
                } | null;
                const room = a.rooms as unknown as { room_number: string } | null;
                return (
                  <Card key={a.id}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">
                            {student?.full_name ?? "Student"}
                          </p>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {a.hotel?.name ?? "Hostel"}
                          {a.hotel?.city ? ` · ${a.hotel.city}` : ""}
                          {room?.room_number ? ` · Room ${room.room_number}` : ""}
                          {a.bed_number ? ` · Bed ${a.bed_number}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[student?.student_ref, student?.program].filter(Boolean).join(" · ")}
                          {a.price ? ` · ${money(a.price, "GHS")}` : ""} · placed{" "}
                          {shortDate(a.created_at)}
                        </p>
                      </div>
                      {a.status === "confirmed" || a.status === "proposed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            run("Placement removed", () =>
                              unplace({ data: { allocationId: a.id } }),
                            )
                          }
                        >
                          Remove
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Place students in a hostel</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="pl-hostel">Hostel</Label>
              <select
                id="pl-hostel"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={hotelId}
                onChange={(e) => setHotelId(e.target.value)}
              >
                <option value="">Choose a hostel…</option>
                {hostels.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.city ? ` · ${h.city}` : ""}
                    {h.from_price ? ` · from ${money(h.from_price, h.currency)}` : ""}
                    {h.affiliated ? " · already working together" : ""}
                  </option>
                ))}
              </select>
              {hostels.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No hostels are listed on Custard yet.
                </p>
              ) : null}
              {selectedHostel ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedHostel.beds} beds
                  {selectedHostel.phone ? ` · ${selectedHostel.phone}` : ""}
                </p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="pl-price">Agreed fee per student (optional)</Label>
              <Input
                id="pl-price"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave empty and the hostel's own per-stay price applies.
              </p>
            </div>

            <div>
              <Label>Students</Label>
              {unplaced.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Every student on your register is already placed.
                </p>
              ) : (
                <div className="mt-1 max-h-64 space-y-1 overflow-y-auto">
                  {unplaced.map((s) => (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-3 border-b border-border py-2 text-sm last:border-0"
                    >
                      <Checkbox
                        checked={picked.includes(s.id)}
                        onCheckedChange={(checked) =>
                          setPicked((prev) =>
                            checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                          )
                        }
                      />
                      <span className="text-foreground">{s.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {[s.student_ref, s.program, s.level_year].filter(Boolean).join(" · ")}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" disabled={busy || !hotelId || picked.length === 0}>
              {busy
                ? "Placing…"
                : `Place ${picked.length || ""} student${picked.length === 1 ? "" : "s"}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </ControllerShell>
  );
}
