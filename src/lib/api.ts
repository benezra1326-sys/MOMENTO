import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, isDatabaseUnavailable } from "./errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Convertit toute erreur en réponse JSON stable { ok:false, error:{ code, message } }. */
export function fail(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) details[issue.path.join(".") || "_"] = issue.message;
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION", message: "Certains champs sont invalides.", details } },
      { status: 400 },
    );
  }
  if (isDatabaseUnavailable(err)) {
    console.error("[db] base de données injoignable", err);
    return NextResponse.json(
      { ok: false, error: { code: "DATABASE_UNAVAILABLE", message: "Service momentanément indisponible. Réessaie dans un instant." } },
      { status: 503 },
    );
  }
  console.error("[api] erreur inattendue", err);
  return NextResponse.json(
    { ok: false, error: { code: "INTERNAL", message: "Une erreur inattendue est survenue." } },
    { status: 500 },
  );
}

/** Protection CSRF simple : les mutations doivent venir de la même origine. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // requêtes serveur à serveur / outils CLI
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Origine refusée.");
  }
  if (originHost !== host) throw new AppError("FORBIDDEN", "Origine refusée.");
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError("VALIDATION", "Corps de requête JSON invalide.");
  }
}
