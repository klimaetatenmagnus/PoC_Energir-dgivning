// Test av borettslag/sameie-strategi
// Migrert fra: scripts/test-borettslag-strategy.ts

import { describe, it, expect, beforeAll } from "vitest";
import { matrikkelEndpoint } from "../../../src/utils/endpoints.ts";
import { MatrikkelClient } from "../../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../../src/clients/BygningClient.ts";
import { StoreClient } from "../../../src/clients/StoreClient.ts";
import { shouldProcessBuildingType } from "../../../src/utils/buildingTypeUtils.ts";
import { ctx } from "../../fixtures/matrikkel-context.ts";

const LIVE = process.env.LIVE === "1";

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

describe.skipIf(!LIVE)("Borettslag-strategi", () => {
  let matrikkelClient: MatrikkelClient;
  let bygningClient: BygningClient;
  let storeClient: StoreClient;

  beforeAll(() => {
    matrikkelClient = new MatrikkelClient(
      matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
      USERNAME,
      PASSWORD
    );

    bygningClient = new BygningClient(
      matrikkelEndpoint(BASE_URL, "BygningService"),
      USERNAME,
      PASSWORD
    );

    storeClient = new StoreClient(
      matrikkelEndpoint(BASE_URL, "StoreService"),
      USERNAME,
      PASSWORD
    );
  });

  describe("Fallanveien 29 (0301-75/812)", () => {
    let alleByggIds: Set<number>;
    let boligbygg: Array<{
      id: number;
      bruksarealM2: number | null;
      byggeaar: number | null;
      bygningstypeKodeId: number | undefined;
    }>;

    beforeAll(async () => {
      // 1. Finn ALLE matrikkelenheter for gnr/bnr (uten adresse-filter)
      const alleIds = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 75,
          bnr: 812,
        },
        ctx()
      );

      // 2. Samle alle unike bygg-IDer
      alleByggIds = new Set<number>();

      for (const matrikkelId of alleIds) {
        const byggIds = await bygningClient.findByggForMatrikkelenhet(matrikkelId, ctx());
        byggIds.forEach((id) => alleByggIds.add(id));
      }

      // 3. Hent info om alle bygninger og filtrer til boligbygg
      boligbygg = [];

      for (const byggId of Array.from(alleByggIds)) {
        try {
          const byggInfo = await storeClient.getObject(byggId);

          // Sjekk om det er boligbygg
          if (shouldProcessBuildingType(byggInfo.bygningstypeKodeId)) {
            boligbygg.push({
              id: byggId,
              bruksarealM2: byggInfo.bruksarealM2,
              byggeaar: byggInfo.byggeaar,
              bygningstypeKodeId: byggInfo.bygningstypeKodeId,
            });
          }
        } catch {
          // Ignorer bygg som ikke kan hentes
        }
      }

      // Sorter etter bruksareal (storst forst)
      boligbygg.sort((a, b) => (b.bruksarealM2 ?? 0) - (a.bruksarealM2 ?? 0));
    });

    it("skal finne flere matrikkelenheter pa gnr/bnr", async () => {
      const alleIds = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 75,
          bnr: 812,
        },
        ctx()
      );

      expect(alleIds.length).toBeGreaterThan(0);
    });

    it("skal finne unike bygninger pa eiendommen", () => {
      expect(alleByggIds.size).toBeGreaterThan(0);
    });

    it("skal identifisere boligbygg blant alle bygg", () => {
      expect(boligbygg.length).toBeGreaterThan(0);
    });

    it("boligbygg skal ha bruksareal", () => {
      boligbygg.forEach((b) => {
        expect(b.bruksarealM2).toBeDefined();
        expect(b.bruksarealM2).toBeGreaterThan(0);
      });
    });

    it("skal logge sammendrag", () => {
      const totaltAreal = boligbygg.reduce((sum, b) => sum + (b.bruksarealM2 ?? 0), 0);
      const gjennomsnittligByggeaar = Math.round(
        boligbygg.reduce((sum, b) => sum + (b.byggeaar ?? 0), 0) / boligbygg.length
      );

      console.log("\n=== BORETTSLAG SAMMENDRAG ===");
      console.log(`Totalt unike bygg: ${alleByggIds.size}`);
      console.log(`Antall boligbygg: ${boligbygg.length}`);
      console.log(`Totalt bruksareal: ${totaltAreal} m2`);
      console.log(`Gjennomsnittlig byggear: ${gjennomsnittligByggeaar}`);
    });
  });
});
