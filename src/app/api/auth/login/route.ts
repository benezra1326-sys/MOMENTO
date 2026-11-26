import { writeRoute } from "@/lib/route";
import { login } from "@/server/accounts";

export const POST = writeRoute(async ({ body }) => login(body));
