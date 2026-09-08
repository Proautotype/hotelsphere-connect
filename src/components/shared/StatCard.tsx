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
    <div className={cn("ink kinetic-tilt min-w-0 bg-card p-4", shadowMap[tone])}>
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className={cn("ink flex size-8 shrink-0 items-center justify-center", toneMap[tone])}>
            <Icon className="size-4" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="kinetic-label truncate text-[10px] text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-lg font-extrabold leading-tight tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-xl">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
