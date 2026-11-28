import { writeRoute } from "@/lib/route";
import { simulatePayment } from "@/server/billing";

/** POST /api/billing/simulate — paiement de test sans Stripe (aucun débit). */
export const POST = writeRoute(async ({ viewer, body }) => simulatePayment(viewer, body));
