import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://take_my_money:take_my_money@localhost:54329/take_my_money",
  },
  strict: true,
  verbose: true,
});
