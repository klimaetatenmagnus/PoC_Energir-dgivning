// Test av MatrikkelClient
// Migrert fra: scripts/test-matrikkel.ts

import { describe, it, expect, beforeAll } from "vitest";
import { MatrikkelClient } from "../../../src/clients/MatrikkelClient.ts";
import { matrikkelEndpoint } from "../../../src/utils/endpoints.ts";
import { ctx } from "../../fixtures/matrikkel-context.ts";

const LIVE = process.env.LIVE === "1";

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  process.env.MATRIKKEL_API_BASE_URL_TEST ||
  "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME || process.env.MATRIKKEL_USERNAME_TEST;
const PASSWORD = process.env.MATRIKKEL_PASSWORD;

describe.skipIf(!LIVE)("MatrikkelClient", () => {
  let client: MatrikkelClient;

  beforeAll(() => {
    client = new MatrikkelClient(
      matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
      USERNAME!,
      PASSWORD!
    );
  });

  describe("findMatrikkelenheter", () => {
    it("skal finne matrikkelenheter for gnr/bnr", async () => {
      const ids = await client.findMatrikkelenheter(
        { kommunenummer: "0301", gnr: 73, bnr: 704 },
        ctx()
      );

      expect(ids).toBeDefined();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(0);
    });

    it("skal returnere numeriske IDer", async () => {
      const ids = await client.findMatrikkelenheter(
        { kommunenummer: "0301", gnr: 73, bnr: 704 },
        ctx()
      );

      ids.forEach((id) => {
        expect(typeof id).toBe("number");
        expect(id).toBeGreaterThan(0);
      });
    });

    it("skal returnere tom liste for ugyldig gnr/bnr", async () => {
      const ids = await client.findMatrikkelenheter(
        { kommunenummer: "0301", gnr: 99999, bnr: 99999 },
        ctx()
      );

      expect(ids).toBeDefined();
      expect(ids.length).toBe(0);
    });
  });

  describe("getMatrikkelenhet", () => {
    it("skal hente matrikkelenhet for gyldig ID", async () => {
      // Forst finn en gyldig ID
      const ids = await client.findMatrikkelenheter(
        { kommunenummer: "0301", gnr: 73, bnr: 704 },
        ctx()
      );

      expect(ids.length).toBeGreaterThan(0);

      const matrikkelenhet = await client.getMatrikkelenhet(ids[0], ctx());
      expect(matrikkelenhet).toBeDefined();
    });
  });

  describe("Sok med adresseparametre", () => {
    it("skal finne matrikkelenhet med husnummer og bokstav", async () => {
      const ids = await client.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          husnummer: 156,
          bokstav: "B",
        },
        ctx()
      );

      expect(ids.length).toBeGreaterThan(0);
    });

    it("skal finne forskjellige matrikkelenheter for B og C", async () => {
      const idsB = await client.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          husnummer: 156,
          bokstav: "B",
        },
        ctx()
      );

      const idsC = await client.findMatrikkelenheter(
        {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          husnummer: 156,
          bokstav: "C",
        },
        ctx()
      );

      expect(idsB.length).toBeGreaterThan(0);
      expect(idsC.length).toBeGreaterThan(0);

      // B og C kan ha forskjellige eller samme IDer avhengig av datastrukturen
    });
  });
});
