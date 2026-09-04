export function money(value: number | string | null | undefined, currency = "GHS"): string {
  const n = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : 0;
  return `${currency} ${n.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function num(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function shortDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function dayMonth(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GH", { month: "short", day: "numeric" }) : "—";
}

export function dateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("en-GH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

export function today(): string {
  const d = new Date();
  return d.toISOString().split("T")[0]!;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function titleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}
