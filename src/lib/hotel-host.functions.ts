import { createServerFn } from "@tanstack/react-start";

// Hostname labels that never belong to a hotel.
const RESERVED = new Set(["www", "app", "admin", "api", "project", "id-preview", "preview", "localhost", "dev"]);

/**
 * If the request arrived on a hotel subdomain (e.g. ashantipalmhotel.custard.com),
 * return that hotel's public page data so the home page can render its storefront.
 * Returns null for the plain platform hosts, so the normal home page shows.
 */
export const resolveHotelHost = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const host = (request?.headers.get("host") ?? "").split(":")[0]?.toLowerCase() ?? "";
  const labels = host.split(".").filter(Boolean);
  // Needs at least sub.domain.tld to be a subdomain of a real site.
  if (labels.length < 3) return null;
  const label = labels[0]!;
  if (RESERVED.has(label)) return null;
  // lovable.app preview/published hosts are platform hosts, not hotel sites.
  if (host.endsWith("lovable.app")) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: hotels } = await supabaseAdmin
    .from("hotels")
    .select("slug")
    .eq("status", "active")
    .eq("is_public_listed", true);

  const normalise = (value: string) => value.replace(/[^a-z0-9]/g, "");
  const match = (hotels ?? []).find((h) => normalise(h.slug.toLowerCase()) === normalise(label));
  if (!match) return null;

  const { getPublicHotel } = await import("@/lib/discovery.functions");
  const result = await getPublicHotel({ data: { slug: match.slug } });
  if (!result) return null;
  return { slug: match.slug, data: result };
});
