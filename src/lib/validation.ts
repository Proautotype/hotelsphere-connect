import type { ZodError } from "zod";

/**
 * Convert a Zod validation error into a map of field path -> message.
 * Field paths are joined with "." (e.g. "address", "website").
 */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    const message = issue.message || "Invalid value";
    if (!out[key]) out[key] = message;
  }
  return out;
}

/** Human-readable summary for a nested zod error, e.g. "Please check: Hotel name, Email". */
export function friendlyValidationMessage(
  error: ZodError,
  fieldLabel?: (key: string) => string,
): string {
  const fieldErrors = zodFieldErrors(error);
  const keys = Object.keys(fieldErrors);
  if (keys.length <= 1) {
    const only = keys[0];
    if (!only) return "Please check the highlighted fields and try again.";
    return fieldErrors[only]!;
  }
  const labels = keys.slice(0, 5).map((key) => (fieldLabel ? fieldLabel(key) : key));
  return `Please check: ${labels.join(", ")}`;
}
