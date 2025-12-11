// Global test setup for backend-tester
import "../loadEnv.ts";
import { beforeAll } from "vitest";

// Konfigurer miljøvariabler for tester
beforeAll(() => {
  // Minimal logging - kun advarsel hvis kritisk konfigurasjon mangler
  if (
    process.env.LIVE === "1" &&
    !process.env.MATRIKKEL_API_BASE_URL_PROD &&
    !process.env.MATRIKKEL_API_BASE_URL_TEST
  ) {
    console.warn("[test-setup] LIVE=1 men ingen Matrikkel API-URL konfigurert");
  }
});

// MERK: Unhandled rejection-handler er fjernet.
// Vitest håndterer unhandled rejections og rapporterer dem som testfeil.
// En custom handler her kan skjule eller duplisere feilmeldinger.
