import { createFileRoute } from "@tanstack/react-router";
import { handlePaystackWebhook } from "@/lib/payments.functions";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get("x-paystack-signature") ?? "";
        const body = await request.text();
        const result = await handlePaystackWebhook({ data: { signature, body } });
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
