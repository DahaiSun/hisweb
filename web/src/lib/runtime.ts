const DB_UNAVAILABLE_PATTERNS = [
  /DATABASE_URL is not set/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /connection terminated/i,
  /could not connect to server/i,
  /failed to connect/i,
];

export function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function isDatabaseUnavailableMessage(message: string) {
  return DB_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(message));
}

export function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function asErrorLike(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  return input as Record<string, unknown>;
}

function isDbUnavailableCode(code: unknown) {
  if (typeof code !== "string") return false;
  return /^(ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|EHOSTUNREACH)$/i.test(code);
}

function isUnavailableErrorTree(error: unknown, seen = new Set<unknown>()): boolean {
  if (!error || seen.has(error)) return false;
  seen.add(error);

  if (error instanceof Error && isDatabaseUnavailableMessage(error.message)) return true;

  const errorLike = asErrorLike(error);
  if (!errorLike) return false;

  if (isDbUnavailableCode(errorLike.code)) return true;

  if (typeof errorLike.message === "string" && isDatabaseUnavailableMessage(errorLike.message)) {
    return true;
  }

  const cause = errorLike.cause;
  if (cause && isUnavailableErrorTree(cause, seen)) return true;

  const nested = errorLike.errors;
  if (Array.isArray(nested) && nested.some((item) => isUnavailableErrorTree(item, seen))) {
    return true;
  }

  return false;
}

export function isDatabaseUnavailableError(error: unknown) {
  return isUnavailableErrorTree(error);
}
