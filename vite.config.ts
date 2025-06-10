// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],

  resolve: {
    /** ⚑  Viktig: sørg for ÉN fysisk sti  */
    alias: {
      react: resolve(root, "node_modules/react"),
      "react-dom": resolve(root, "node_modules/react-dom"),
    },
    /** ⚑  dedupe hindrer ny kopi i optimize-cache */

    dedupe: ["react", "react-dom"],
  },

  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: [], // ingen avhengigheter skal bringe inn egen React
  },

  server: {
    port: 5173,
    proxy: {
      "/lookup": "http://localhost:4002",
      "/solinnstraling": "http://localhost:4003",
      "/subsidy": "http://localhost:4001",
      "/api": "http://localhost:3000",
    },
  },
});
