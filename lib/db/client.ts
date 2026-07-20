import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

export type AppDatabase = PostgresJsDatabase<typeof schema>;

type GlobalDatabase = typeof globalThis & {
  __takeMyMoneySql?: ReturnType<typeof postgres>;
  __takeMyMoneyDb?: AppDatabase;
};

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL is not configured");
  return value;
}

export function getDatabase(): AppDatabase {
  const globalDatabase = globalThis as GlobalDatabase;
  if (globalDatabase.__takeMyMoneyDb) return globalDatabase.__takeMyMoneyDb;

  const sqlClient = postgres(requireDatabaseUrl(), {
    max: process.env.NODE_ENV === "production" ? 3 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  const database = drizzle(sqlClient, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalDatabase.__takeMyMoneySql = sqlClient;
    globalDatabase.__takeMyMoneyDb = database;
  }

  return database;
}

export async function closeDatabaseForTests(): Promise<void> {
  const globalDatabase = globalThis as GlobalDatabase;
  await globalDatabase.__takeMyMoneySql?.end({ timeout: 5 });
  delete globalDatabase.__takeMyMoneySql;
  delete globalDatabase.__takeMyMoneyDb;
}
