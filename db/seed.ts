import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { targetPlans } from "./schema";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const client = postgres(process.env.DATABASE_URL, { max: 1 });
  const database = drizzle(client);
  const plans: (typeof targetPlans.$inferInsert)[] = [
    {
      id: "direct-basic-monthly",
      displayName: "Direct Basic",
      priceMinor: 1900n,
      currency: "EUR",
      billingInterval: "MONTHLY",
      active: true,
      sortOrder: 1,
      metadata: { illustrative: true },
    },
    {
      id: "direct-pro-monthly",
      displayName: "Direct Pro",
      priceMinor: 22_900n,
      currency: "EUR",
      billingInterval: "MONTHLY",
      active: true,
      sortOrder: 2,
      metadata: { illustrative: true, recommended: true },
    },
    {
      id: "direct-annual",
      displayName: "Direct Annual",
      priceMinor: 229_000n,
      currency: "EUR",
      billingInterval: "ANNUAL",
      active: false,
      sortOrder: 3,
      metadata: { illustrative: true, comingSoon: true },
    },
  ];

  for (const plan of plans) {
    await database
      .insert(targetPlans)
      .values(plan)
      .onConflictDoUpdate({
        target: targetPlans.id,
        set: {
          displayName: plan.displayName,
          priceMinor: plan.priceMinor,
          currency: plan.currency,
          billingInterval: plan.billingInterval,
          active: plan.active,
          sortOrder: plan.sortOrder,
          metadata: plan.metadata,
        },
      });
  }

  await client.end();
  console.log("Database seed applied.");
}

void main();
