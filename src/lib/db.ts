import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __pg: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function client() {
  if (!globalThis.__pg) {
    globalThis.__pg = postgres(env().DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return globalThis.__pg;
}

export function db() {
  if (!globalThis.__db) {
    globalThis.__db = drizzle(client(), { schema });
  }
  return globalThis.__db;
}

export { schema };
