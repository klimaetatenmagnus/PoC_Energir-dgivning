// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  /* ----------------------------------------------------------- */
  /*  Viktig! Sørger for ÉN kopi av React/React-DOM i bundle.     */
  /* ----------------------------------------------------------- */
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },

  /* ----------------------------------------------------------- */
  /*  Dev-server med lokale proxyruter                           */
  /* ----------------------------------------------------------- */
  server: {
    port: 5173,
    proxy: {
      "/lookup": {
        target: "http://localhost:4002",
        changeOrigin: true,
      },
      "/solinnstraling": {
        target: "http://localhost:4003",
        changeOrigin: true,
      },
      "/subsidy": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
      "/api": {
        // SOAP/REST-proxy (Matrikkel-tjenesten)
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
