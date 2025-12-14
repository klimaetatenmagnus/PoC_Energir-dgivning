/// <reference types="vitest/config" />
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.VITE_BASE_PATH ?? "/";
export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    /** ⚑  Viktig: sørg for ÉN fysisk sti  */
    alias: {
      react: resolve(root, "node_modules/react"),
      "react-dom": resolve(root, "node_modules/react-dom")
    },
    /** ⚑  dedupe hindrer ny kopi i optimize-cache */

    dedupe: ["react", "react-dom"]
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: [] // ingen avhengigheter skal bringe inn egen React
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/lookup": "http://localhost:4002",
      "/solinnstraling": "http://localhost:4003",
      "/api": "http://localhost:3001",
      "/admin/api": "http://localhost:4100",
      "/config": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    }
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(root, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        },
        setupFiles: ['.storybook/vitest.setup.ts']
      }
    }]
  }
});