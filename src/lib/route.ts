import { getViewer, type Viewer } from "./auth";
import { assertSameOrigin, fail, ok, readJson } from "./api";
import { AppError } from "./errors";

type Ctx<P> = { params: Promise<P> };

/** Route en lecture : viewer optionnel, erreurs normalisées. */
export function readRoute<P = Record<string, string>>(
  fn: (args: { req: Request; viewer: Viewer | null; params: P }) => Promise<unknown>,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const viewer = await getViewer();
      // L'app est réservée aux membres connectés : aucune lecture sans session.
      if (!viewer) throw new AppError("UNAUTHENTICATED", "Connecte-toi pour continuer.");
      return ok(await fn({ req, viewer, params: await ctx.params }));
    } catch (e) {
      return fail(e);
    }
  };
}

/** Route de mutation : contrôle d'origine, corps JSON, erreurs normalisées. */
export function writeRoute<P = Record<string, string>>(
  fn: (args: { req: Request; viewer: Viewer | null; params: P; body: unknown }) => Promise<unknown>,
  opts: { status?: number; json?: boolean } = {},
) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req);
      const hasBody = opts.json !== false && (req.headers.get("content-type") ?? "").includes("application/json");
      const body = hasBody ? await readJson(req) : {};
      const viewer = await getViewer();
      return ok(await fn({ req, viewer, params: await ctx.params, body }), opts.status ?? 200);
    } catch (e) {
      return fail(e);
    }
  };
}
