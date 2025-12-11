// Test av matrikkel-adresseoppslag
// Migrert fra: scripts/test-matrikkel-direct.ts

import { describe, it, expect, beforeAll } from "vitest";
import { MatrikkelClient } from "../../../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../../../src/clients/BygningClient.ts";
import { StoreClient } from "../../../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../../../src/utils/endpoints.ts";
import { ctx } from "../../fixtures/matrikkel-context.ts";

const LIVE = process.env.LIVE === "1";

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

describe.skipIf(!LIVE)("Matrikkel Adresseoppslag", () => {
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

  describe("Full oppslags-flyt", () => {
    it("skal hente komplett bygningsdata for en adresse", async () => {
      // 1. Finn matrikkelenhets-ID
      const ids = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          husnummer: 156,
          bokstav: "C",
        },
        ctx()
      );

      expect(ids.length).toBeGreaterThan(0);
      const matrikkelenhetsId = ids[0];

      // 2. Finn bygninger for matrikkelenheten
      const byggIds = await bygningClient.findByggForMatrikkelenhet(matrikkelenhetsId, ctx());
      expect(byggIds.length).toBeGreaterThan(0);

      // 3. Hent bygningsdetaljer
      for (const byggId of byggIds.slice(0, 3)) {
        const byggInfo = await storeClient.getObject(byggId);

        expect(byggInfo).toBeDefined();
        expect(byggInfo.bruksarealM2).toBeDefined();
      }
    });
  });

  describe("Fallanveien 29 - Komplett oppslag", () => {
    it("skal finne matrikkelenhets-ID", async () => {
      const ids = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 75,
          bnr: 812,
          adressekode: 11698,
          husnummer: 29,
          bokstav: "",
        },
        ctx()
      );

      expect(ids.length).toBeGreaterThan(0);
    });

    it("skal finne bygninger for matrikkelenheten", async () => {
      const ids = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 75,
          bnr: 812,
          adressekode: 11698,
          husnummer: 29,
        },
        ctx()
      );

      const byggIds = await bygningClient.findByggForMatrikkelenhet(ids[0], ctx());
      expect(byggIds.length).toBeGreaterThan(0);
    });

    it("skal hente bygningsdetaljer", async () => {
      const ids = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 75,
          bnr: 812,
          husnummer: 29,
        },
        ctx()
      );

      const byggIds = await bygningClient.findByggForMatrikkelenhet(ids[0], ctx());
      const byggInfo = await storeClient.getObject(byggIds[0]);

      console.log("\nFallanveien 29 - Bygningsdetaljer:");
      console.log(`  ID: ${byggIds[0]}`);
      console.log(`  Bruksareal: ${byggInfo.bruksarealM2} m2`);
      console.log(`  Byggear: ${byggInfo.byggeaar}`);
      console.log(`  Bygningstype: ${byggInfo.bygningstypeKodeId}`);

      expect(byggInfo.bruksarealM2).toBeGreaterThan(0);
    });
  });
});
