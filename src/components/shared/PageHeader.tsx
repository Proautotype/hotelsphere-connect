import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="animate-swipe">
        <h1 className="font-display text-3xl font-extrabold uppercase leading-[0.9] tracking-tighter text-foreground sm:text-4xl">
          {title}
        </h1>
        <div className="mt-2 h-[3px] w-16 bg-primary" />
        {description ? (
          <p className="mt-3 max-w-2xl text-sm font-medium text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
