import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,

    // ⇣ Lokal proxy-ruting for dev-miljøet
    proxy: {
      "/lookup": {
        target: "http://localhost:4002",
        changeOrigin: true,
      },
      "/solinnstraling": {
        target: "http://localhost:4002",
        changeOrigin: true,
      },
      "/subsidy": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
      "/api": {
        // SOAP-/REST-proxy (Matrikkel-tjenesten)
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
