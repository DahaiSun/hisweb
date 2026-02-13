import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __financialHistoryPgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getDbPool() {
  if (!global.__financialHistoryPgPool) {
    global.__financialHistoryPgPool = createPool();
  }
  return global.__financialHistoryPgPool;
}
