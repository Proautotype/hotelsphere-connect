import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center border-[3px] border-dashed border-ink bg-card py-14 text-center">
      <div className="ink flex size-12 items-center justify-center bg-amber text-amber-foreground">
        <Icon className="size-6" />
      </div>
      <h3 className="mt-4 font-display text-lg font-extrabold uppercase tracking-tight text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
