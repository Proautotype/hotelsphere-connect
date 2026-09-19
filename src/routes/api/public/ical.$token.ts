import { createFileRoute } from "@tanstack/react-router";
import { getChannelIcal } from "@/lib/channels.functions";

export const Route = createFileRoute("/api/public/ical/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = (params.token ?? "").replace(/\.ics$/i, "");
        if (!/^[0-9a-f-]{36}$/i.test(token)) {
          return new Response("Not found", { status: 404 });
        }
        const result = await getChannelIcal({ data: { token } });
        if (!result.found) return new Response("Not found", { status: 404 });
        return new Response(result.ics, {
          status: 200,
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Content-Disposition": 'inline; filename="custard-hotels.ics"',
          },
        });
      },
    },
  },
});
