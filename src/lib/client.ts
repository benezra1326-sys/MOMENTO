"use client";

export type ApiError = { code: string; message: string; details?: Record<string, string> };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Appel API côté client : ne lève jamais, renvoie { ok, data | error }. */
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => null);
    if (json && typeof json === "object" && "ok" in json) return json as ApiResult<T>;
    return { ok: false, error: { code: "INTERNAL", message: `Erreur ${res.status}.` } };
  } catch {
    return {
      ok: false,
      error: { code: "NETWORK", message: "Pas de connexion. Vérifie ton réseau et réessaie." },
    };
  }
}
