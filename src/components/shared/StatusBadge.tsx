import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

interface StatusBadgeProps {
  status: string | null | undefined;
}

type Tone = "default" | "secondary" | "outline" | "destructive" | "warning";

function toneFor(status: string): Tone {
  const s = (status ?? "").toLowerCase();
  if (["active", "confirmed", "checked_in", "successful", "available", "clean", "inspected", "open", "paid"].includes(s)) return "default";
  if (["pending", "reserved", "processing", "cleaning", "staff", "partially_refunded"].includes(s)) return "secondary";
  if (["suspended", "maintenance", "out_of_service", "no_show", "failed", "cancelled", "rejected", "overdue"].includes(s)) return "destructive";
  if (["checked_out", "closed", "dirty", "refunded"].includes(s)) return "outline";
  if (["occupancy", "warning", "amber"].includes(s)) return "warning";
  return "secondary";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = toneFor(status ?? "");
  const base = "border-[2px] border-ink font-display text-[10px] font-extrabold uppercase tracking-widest";
  if (tone === "warning") {
    return <Badge variant="outline" className={cn(base, "bg-amber text-amber-foreground")}>{titleCase(status)}</Badge>;
  }
  return <Badge variant={tone} className={base}>{titleCase(status)}</Badge>;
}
