import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const database = drizzle(client);

  await migrate(database, { migrationsFolder: "db/migrations" });
  await client.end();
  console.log("Database migrations applied.");
}

void main();
