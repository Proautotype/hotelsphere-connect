import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "accent" | "success" | "warning" | "destructive";
}

const toneMap: Record<string, string> = {
  default: "bg-ink text-background",
  primary: "bg-primary text-primary-foreground",
  accent: "bg-amber text-amber-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  destructive: "bg-destructive text-destructive-foreground",
};

const shadowMap: Record<string, string> = {
  default: "shadow-hard",
  primary: "shadow-hard-teal",
  accent: "shadow-hard-amber",
  success: "shadow-hard",
  warning: "shadow-hard-amber",
  destructive: "shadow-hard",
};

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className={cn("ink kinetic-tilt bg-card p-5", shadowMap[tone])}>
      <div className="flex items-start gap-4">
        {Icon ? (
          <div className={cn("ink flex size-10 shrink-0 items-center justify-center", toneMap[tone])}>
            <Icon className="size-5" />
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="kinetic-label text-[11px] text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-tighter text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}
