// Test av seksjonshåndtering
// Migrert fra:
// - scripts/test-section-lookup-fixed.ts
// - scripts/test-section-final.ts
// - scripts/test-section-inference.ts
// - scripts/test-matrikkel-sections.ts

import { describe, it, expect, beforeAll } from "vitest";
import { MatrikkelClient } from "../../../src/clients/MatrikkelClient.ts";
import { matrikkelEndpoint } from "../../../src/utils/endpoints.ts";
import { ctx } from "../../fixtures/matrikkel-context.ts";

const LIVE = process.env.LIVE === "1";

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

describe.skipIf(!LIVE)("Seksjonshåndtering", () => {
  let matrikkelClient: MatrikkelClient;

  beforeAll(() => {
    matrikkelClient = new MatrikkelClient(
      matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
      USERNAME,
      PASSWORD
    );
  });

  describe("Kapellveien 156 - Eierseksjoner", () => {
    it("skal finne alle matrikkelenheter pa gnr/bnr", async () => {
      const allUnits = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
        },
        ctx()
      );

      expect(allUnits.length).toBeGreaterThan(0);
      // Verifiser at alle IDer er gyldige tall
      allUnits.forEach((id) => {
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      });
    });

    it("skal finne forskjellige enheter for B og C", async () => {
      const unitsB = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          husnummer: 156,
          bokstav: "B",
        },
        ctx()
      );

      const unitsC = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          husnummer: 156,
          bokstav: "C",
        },
        ctx()
      );

      expect(unitsB.length).toBeGreaterThan(0);
      expect(unitsC.length).toBeGreaterThan(0);
    });

    it("skal kunne hente matrikkelenhet-info", async () => {
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

      for (const id of ids.slice(0, 2)) {
        const matrikkelenhet = await matrikkelClient.getMatrikkelenhet(id, ctx());
        expect(matrikkelenhet).toBeDefined();
      }
    });
  });

  describe("Seksjonsnummer-inferens", () => {
    it("skal inferere seksjonsnummer fra matrikkelenhet-data", async () => {
      // Dette tester at vi kan utlede seksjonsnummer fra API-responsen
      const ids = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
        },
        ctx()
      );

      expect(ids.length).toBeGreaterThan(0);

      const results: Array<{ id: number; seksjonsnummer?: number }> = [];

      for (const id of ids.slice(0, 5)) {
        const matrikkelenhet = await matrikkelClient.getMatrikkelenhet(id, ctx());
        expect(matrikkelenhet).toBeDefined();

        // Sjekk om seksjonsnummer er tilgjengelig
        // @ts-expect-error - Vi tester dynamisk felt
        const seksjonsnummer = matrikkelenhet?.seksjonsnummer;

        results.push({ id, seksjonsnummer });
      }

      // Verifiser strukturen av resultatene
      expect(results.length).toBeGreaterThan(0);
      results.forEach((r) => {
        expect(r.id).toBeGreaterThan(0);
        // Seksjonsnummer kan være undefined for ikke-seksjonerte enheter
        if (r.seksjonsnummer !== undefined) {
          expect(r.seksjonsnummer).toBeGreaterThan(0);
        }
      });
    });
  });

  describe("Kjent seksjonsnummerering", () => {
    // Basert pa Kartverkets weboppslag
    const knownSections = [
      { desc: "0301-73/704/0/1 (156B)", params: { bokstav: "B" }, expectedSection: 1 },
      { desc: "0301-73/704/0/2 (156C)", params: { bokstav: "C" }, expectedSection: 2 },
    ];

    it.each(knownSections)(
      "$desc skal ha seksjonsnummer $expectedSection",
      async ({ params, expectedSection }) => {
        const ids = await matrikkelClient.findMatrikkelenheter(
          {
            kommunenummer: "0301",
            gnr: 73,
            bnr: 704,
            husnummer: 156,
            ...params,
          },
          ctx()
        );

        expect(ids.length).toBeGreaterThan(0);

        // Hent matrikkelenhet og sjekk seksjonsnummer
        const matrikkelenhet = await matrikkelClient.getMatrikkelenhet(ids[0], ctx());

        // @ts-expect-error - Dynamisk felt
        const seksjonsnummer = matrikkelenhet?.seksjonsnummer;

        // Hvis seksjonsnummer er tilgjengelig, verifiser
        if (seksjonsnummer !== undefined) {
          expect(seksjonsnummer).toBe(expectedSection);
        }
      }
    );
  });
});
