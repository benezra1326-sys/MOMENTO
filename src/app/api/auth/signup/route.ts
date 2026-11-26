import { writeRoute } from "@/lib/route";
import { signup } from "@/server/accounts";

export const POST = writeRoute(async ({ body }) => signup(body), { status: 201 });
