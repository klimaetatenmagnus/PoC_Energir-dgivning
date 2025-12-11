import { defineConfig } from "vitest/config";

// Sjekk om vi kjører live integrasjons-/E2E-tester
const isLive = process.env.LIVE === "1";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".storybook"],
    globals: true,
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30000, // 30s for integrasjonstester
    hookTimeout: 30000,
    // Kjør sekvensielt (singleFork) kun for live-tester for å unngå API-overbelastning.
    // Unit-tester (LIVE !== "1") kjøres parallelt for bedre ytelse.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: isLive,
      },
    },
  },
});
