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

export function isDatabaseUnavailableError(error: unknown) {
  return isDatabaseUnavailableMessage(toErrorMessage(error));
}
