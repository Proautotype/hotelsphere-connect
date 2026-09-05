import { createFileRoute, notFound } from "@tanstack/react-router";
import { HotelSite } from "@/components/discovery/HotelSite";
import { DiscoveryLayout } from "@/components/discovery/DiscoveryLayout";
import { getPublicHotel } from "@/lib/discovery.functions";

// Every hotel gets its own short address, e.g. /ashanti-palm-hotel. This route is
// matched last, so all named pages (/discover, /auth, /admin/*, ...) still win.
export const Route = createFileRoute("/$hotelSlug")({
  loader: async ({ params }) => {
    const result = await getPublicHotel({ data: { slug: params.hotelSlug } });
    if (!result) throw notFound();
    return result;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Hotel not found — Custard Hotels" }, { name: "robots", content: "noindex" }] };
    }
    const name = loaderData.hotel.name;
    const city = loaderData.hotel.city ?? "Ghana";
    const title = `${name}, ${city} — Book direct`;
    const description = `Rooms, rates and instant booking at ${name} in ${city}. Pay with Mobile Money or at the front desk.`;
    const cover = loaderData.hotel.cover_url ?? null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(cover && cover.startsWith("https://")
          ? [
              { property: "og:image", content: cover },
              { name: "twitter:image", content: cover },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: () => (
    <DiscoveryLayout>
      <p className="ink bg-card p-6 font-medium">That page isn't available. Try browsing hotels instead.</p>
    </DiscoveryLayout>
  ),
  errorComponent: () => (
    <DiscoveryLayout>
      <p className="ink bg-card p-6 font-medium">We couldn't load this hotel right now. Please refresh.</p>
    </DiscoveryLayout>
  ),
  component: HotelSlugPage,
});

function HotelSlugPage() {
  const initial = Route.useLoaderData();
  const { hotelSlug } = Route.useParams();
  return <HotelSite initial={initial} slug={hotelSlug} />;
}
