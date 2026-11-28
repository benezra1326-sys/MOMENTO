import { writeRoute } from "@/lib/route";
import { startCheckout } from "@/server/billing";

/** POST /api/billing/checkout — démarre le paiement Upclose+ (Stripe Checkout, ou paiement simulé). */
export const POST = writeRoute(async ({ req, viewer }) => startCheckout(viewer, req.headers.get("origin") ?? new URL(req.url).origin));
