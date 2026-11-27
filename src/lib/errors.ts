/** Erreurs métier stables : un code machine + un message lisible en français. */
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "MOMENT_FULL"
  | "MOMENT_NOT_OPEN"
  | "RATE_LIMITED"
  | "BLOCKED"
  | "ACCOUNT_SUSPENDED"
  | "EMAIL_NOT_VERIFIED"
  | "ADULT_ONLY"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL";

const httpStatus: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  MOMENT_FULL: 409,
  MOMENT_NOT_OPEN: 409,
  RATE_LIMITED: 429,
  BLOCKED: 403,
  ACCOUNT_SUSPENDED: 403,
  EMAIL_NOT_VERIFIED: 403,
  ADULT_ONLY: 403,
  DATABASE_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, string>,
  ) {
    super(message);
  }
  get status() {
    return httpStatus[this.code];
  }
}

export function isDatabaseUnavailable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  const code = (err as { errorCode?: string; code?: string }).errorCode ?? (err as { code?: string }).code ?? "";
  return (
    name === "PrismaClientInitializationError" ||
    ["P1000", "P1001", "P1002", "P1011", "P1017"].includes(code)
  );
}

/** Violation d'unicité Prisma (P2002) : deux inscriptions simultanées sur le même e-mail ou pseudo. */
export function isUniqueViolation(e: unknown): e is { code: "P2002"; meta?: { target?: string[] | string } } {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
