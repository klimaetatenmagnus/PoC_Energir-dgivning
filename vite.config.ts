/// <reference types="vitest/config" />
// vite.config.ts
import { defineConfig, type Plugin, type IndexHtmlTransformContext } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { TEMA_CONFIGS, type TemaId } from './src/tema';
import { applyTemaToHtml, makeStylesheetsAsync } from './src/temaStaticHtml';

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.VITE_BASE_PATH ?? "/";

/**
 * Prerendrede annonse-landingssider: skriver unik head-metadata og statisk
 * over-folden-innhold inn i hver HTML-entry (kilde: src/tema.ts), og gjør
 * CSS-bundelen asynkron i build slik at første tegning ikke blokkeres.
 */
function temaLandingPlugin(): Plugin {
  return {
    name: 'tema-landing',
    transformIndexHtml: {
      order: 'post',
      handler(html: string, ctx: IndexHtmlTransformContext) {
        const file = ctx.filename.replace(/\\/g, '/');
        const match = file.match(/\/(solceller|vinduer|varmepumpe)\/index\.html$/);
        const tema = match ? TEMA_CONFIGS[match[1] as TemaId] : null;
        html = applyTemaToHtml(html, tema, file);
        // Async CSS kun i build — i dev injiseres CSS via JS uansett
        if (!ctx.server) {
          html = makeStylesheetsAsync(html);
        }
        return html;
      },
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), temaLandingPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        solceller: resolve(root, "solceller/index.html"),
        vinduer: resolve(root, "vinduer/index.html"),
        varmepumpe: resolve(root, "varmepumpe/index.html"),
      },
    },
  },
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
      "/admin/api": {
        target: "http://localhost:4100",
        headers: {
          "x-goog-authenticated-user-email": "accounts.google.com:local-redaktor@energinokkelen.dev",
        },
      },
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