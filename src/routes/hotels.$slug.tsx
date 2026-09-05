import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy address — hotels now live at their own short address (/:hotelSlug).
export const Route = createFileRoute("/hotels/$slug")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$hotelSlug", params: { hotelSlug: params.slug }, statusCode: 301 });
  },
});
