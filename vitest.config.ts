import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

dotenv.config({ path: ".env.local", quiet: true });

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "@take-my-money/billing-core": fileURLToPath(
        new URL("./packages/billing-core/src/index.ts", import.meta.url),
      ),
      "@take-my-money/provider-contracts": fileURLToPath(
        new URL("./packages/provider-contracts/src/index.ts", import.meta.url),
      ),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    fileParallelism: false,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "**/node_modules/**", ".next/**"],
  },
});
