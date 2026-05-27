import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle client singleton.
 *
 * Uses the `DATABASE_URL` env var which should point to your Supabase
 * PostgreSQL connection string (the "Transaction" pooler URI for
 * serverless / short-lived connections).
 *
 * The `schema` import enables type-safe relational queries with `db.query.*`.
 */

const connectionString = process.env.DATABASE_URL!;

// Use a global singleton in development to survive HMR reloads.
const globalForDb = globalThis as unknown as {
  pgConnection: ReturnType<typeof postgres> | undefined;
};

const connection = globalForDb.pgConnection ?? postgres(connectionString, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgConnection = connection;
}

export const db = drizzle(connection, { schema });
