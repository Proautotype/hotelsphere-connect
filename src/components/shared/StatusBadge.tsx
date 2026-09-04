import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";

interface StatusBadgeProps {
  status: string | null | undefined;
}

function toneFor(status: string): "default" | "secondary" | "outline" | "destructive" | "warning" {
  const s = (status ?? "").toLowerCase();
  if (["active", "confirmed", "checked_in", "successful", "available", "clean", "inspected", "open", "paid"].includes(s)) return "default";
  if (["pending", "reserved", "processing", "cleaning", "staff", "partially_refunded"].includes(s)) return "secondary";
  if (["suspended", "maintenance", "out_of_service", "no_show", "failed", "cancelled", "rejected", "overdue"].includes(s)) return "destructive";
  if (["checked_out", "closed", "dirty", "refunded"].includes(s)) return "outline";
  if (["occupancy", "warning", "amber"].includes(s)) return "warning";
  return "secondary";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Badge variant={toneFor(status ?? "")}>{titleCase(status)}</Badge>;
}
