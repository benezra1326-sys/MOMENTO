import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Santé : indique honnêtement si la base répond. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "up", demoMode: isDemoMode() });
  } catch {
    return NextResponse.json({ ok: false, database: "down", demoMode: isDemoMode() }, { status: 503 });
  }
}
