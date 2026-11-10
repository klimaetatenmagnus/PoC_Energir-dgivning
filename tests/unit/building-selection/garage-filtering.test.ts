// Test av filtrering av garasjer, uthus og andre ikke-boligbygg
// Migrert fra: scripts/test-garage-filtering.ts

import { describe, it, expect, beforeAll } from "vitest";
import {
  shouldProcessBuildingType,
  determineBuildingTypeStrategy,
} from "../../../src/utils/buildingTypeUtils.ts";
import { StoreClient } from "../../../src/clients/StoreClient.ts";
import { BygningClient } from "../../../src/clients/BygningClient.ts";
import { matrikkelEndpoint } from "../../../src/utils/endpoints.ts";
import { ctx } from "../../fixtures/matrikkel-context.ts";

const LIVE = process.env.LIVE === "1";

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  "https://innsyn.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

describe("Building Type Filtering - Unit Tests", () => {
  // Test-cases for bygningstype-filtrering.
  // `id` er Matrikkelens interne bygningstypeKodeId, `kode` er 3-sifret
  // bygningstypekode. De to må aldri blandes: ID 111 er sykehjem (kode 721).
  const testCases: Array<{
    source: { bygningstypeKodeId?: number; bygningstypeKode?: string };
    name: string;
    expected: boolean;
  }> = [
    // Boligbygg som SKAL behandles
    { source: { bygningstypeKodeId: 1 }, name: "Enebolig (intern ID 1)", expected: true },
    { source: { bygningstypeKodeId: 4 }, name: "Tomannsbolig (intern ID 4)", expected: true },
    { source: { bygningstypeKode: "111" }, name: "Enebolig (kode 111)", expected: true },
    { source: { bygningstypeKode: "121" }, name: "Tomannsbolig, vertikaldelt (kode 121)", expected: true },
    { source: { bygningstypeKode: "131" }, name: "Rekkehus (kode 131)", expected: true },
    { source: { bygningstypeKode: "141" }, name: "Store frittliggende boligbygg pa 2 etasjer (kode 141)", expected: true },

    // Ikke-bolig eller ekskluderte bygg som IKKE skal behandles
    { source: { bygningstypeKodeId: 26 }, name: "Garasje, uthus, anneks (intern ID 26)", expected: false },
    { source: { bygningstypeKode: "181" }, name: "Garasje, uthus, anneks knyttet til bolig (kode 181)", expected: false },
    { source: { bygningstypeKode: "182" }, name: "Garasje i boligbygg (kode 182)", expected: false },
    { source: { bygningstypeKode: "183" }, name: "Innhegnet garasjeanlegg (kode 183)", expected: false },
    { source: { bygningstypeKode: "189" }, name: "Annen garasje/uthus (kode 189)", expected: false },
    { source: { bygningstypeKode: "211" }, name: "Fabrikkbygning (kode 211)", expected: false },
    { source: { bygningstypeKode: "311" }, name: "Kontor- og administrasjonsbygg (kode 311)", expected: false },
    { source: {}, name: "Undefined building type", expected: false },
  ];

  describe("shouldProcessBuildingType", () => {
    it.each(testCases)(
      "$name skal returnere $expected",
      ({ source, expected }) => {
        const result = shouldProcessBuildingType(source);
        expect(result).toBe(expected);
      }
    );
  });

  describe("determineBuildingTypeStrategy", () => {
    it("skal returnere 'building' for boligbygg", () => {
      const strategy = determineBuildingTypeStrategy({ bygningstypeKode: "111" });
      expect(strategy.reportingLevel).toBe("building");
    });

    it("skal returnere 'skip' for garasjer", () => {
      const strategy = determineBuildingTypeStrategy({ bygningstypeKode: "181" });
      expect(strategy.reportingLevel).toBe("skip");
    });

    it("skal ha beskrivelse for alle typer", () => {
      testCases.forEach(({ source }) => {
        const strategy = determineBuildingTypeStrategy(source);
        expect(strategy.description).toBeDefined();
        expect(strategy.description.length).toBeGreaterThan(0);
      });
    });
  });
});

describe.skipIf(!LIVE)("Building Type Filtering - Integration", () => {
  let storeClient: StoreClient;
  let bygningClient: BygningClient;

  beforeAll(() => {
    storeClient = new StoreClient(
      matrikkelEndpoint(BASE_URL, "StoreService"),
      USERNAME,
      PASSWORD
    );

    bygningClient = new BygningClient(
      matrikkelEndpoint(BASE_URL, "BygningService"),
      USERNAME,
      PASSWORD
    );
  });

  describe("Reell eiendom med flere bygninger", () => {
    // Kapellveien 156 - vi vet har flere bygninger
    const matrikkelenhetsId = 510390945;

    let buildings: Array<{
      id: number;
      area: number | null;
      type: number | undefined;
      shouldProcess: boolean;
    }>;

    beforeAll(async () => {
      const byggIds = await bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx());

      buildings = [];
      for (const byggId of byggIds) {
        try {
          const byggData = await storeClient.getObject(byggId);
          const shouldProcess = shouldProcessBuildingType(byggData);

          buildings.push({
            id: byggId,
            area: byggData.bruksarealM2,
            type: byggData.bygningstypeKodeId,
            shouldProcess,
          });
        } catch {
          // Ignorer bygg som ikke kan hentes
        }
      }

      buildings.sort((a, b) => (b.area || 0) - (a.area || 0));
    });

    it("skal finne flere bygninger", () => {
      expect(buildings.length).toBeGreaterThan(0);
    });

    it("skal identifisere minst ett boligbygg", () => {
      const processed = buildings.filter((b) => b.shouldProcess);
      expect(processed.length).toBeGreaterThan(0);
    });

    it("boligbygg skal ha storre areal enn garasjer", () => {
      const processed = buildings.filter((b) => b.shouldProcess);
      const filtered = buildings.filter((b) => !b.shouldProcess);

      if (processed.length > 0 && filtered.length > 0) {
        const maxProcessedArea = Math.max(...processed.map((b) => b.area || 0));
        const maxFilteredArea = Math.max(...filtered.map((b) => b.area || 0));

        // Generelt skal boligbygg vare storre enn garasjer
        expect(maxProcessedArea).toBeGreaterThan(maxFilteredArea);
      }
    });

    it("skal logge analyse", () => {
      const processed = buildings.filter((b) => b.shouldProcess);
      const filtered = buildings.filter((b) => !b.shouldProcess);

      console.log("\n=== BUILDING FILTERING ANALYSIS ===");
      console.log(`Total buildings: ${buildings.length}`);
      console.log(`Processed (residential): ${processed.length}`);
      console.log(`Filtered out: ${filtered.length}`);

      if (filtered.length > 0) {
        console.log("\nFiltered buildings:");
        filtered.forEach((b) => {
          const strategy = determineBuildingTypeStrategy({ bygningstypeKodeId: b.type });
          console.log(`  - ${strategy.description} (${b.area} m2)`);
        });
      }
    });
  });
});
