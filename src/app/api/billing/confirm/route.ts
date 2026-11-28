import { z } from "zod";
import { writeRoute } from "@/lib/route";
import { confirmCheckout } from "@/server/billing";

/** POST /api/billing/confirm — vérifie la session Stripe au retour du paiement. */
export const POST = writeRoute(async ({ viewer, body }) => confirmCheckout(viewer, z.object({ sessionId: z.string() }).parse(body).sessionId));
