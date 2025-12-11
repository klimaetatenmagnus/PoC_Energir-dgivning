// Test av XML-parsing for seksjonsnummer og andre felt
// Migrert fra: scripts/test-xml-parsing.ts

import { describe, it, expect, beforeAll } from "vitest";
import { MatrikkelClient } from "../../../src/clients/MatrikkelClient.ts";
import { StoreClient } from "../../../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../../../src/utils/endpoints.ts";
import { ctx } from "../../fixtures/matrikkel-context.ts";

const LIVE = process.env.LIVE === "1";

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

describe.skipIf(!LIVE)("XML Parsing - Seksjonsnummer", () => {
  let matrikkelClient: MatrikkelClient;
  let storeClient: StoreClient;

  beforeAll(() => {
    matrikkelClient = new MatrikkelClient(
      matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
      USERNAME,
      PASSWORD
    );

    storeClient = new StoreClient(
      matrikkelEndpoint(BASE_URL, "StoreService"),
      USERNAME,
      PASSWORD
    );
  });

  describe("Kapellveien 156 - Seksjonert eiendom", () => {
    const searches = [
      {
        desc: "156B",
        params: {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          bokstav: "B",
          husnummer: 156,
          adressekode: 13616,
        },
      },
      {
        desc: "156C",
        params: {
          kommunenummer: "0301",
          gnr: 73,
          bnr: 704,
          bokstav: "C",
          husnummer: 156,
          adressekode: 13616,
        },
      },
    ];

    it.each(searches)("skal finne matrikkelenheter for $desc", async (search) => {
      const ids = await matrikkelClient.findMatrikkelenheter(search.params, ctx());
      expect(ids.length).toBeGreaterThan(0);
    });

    it("skal kunne hente XML for matrikkelenheter", async () => {
      const ids = await matrikkelClient.findMatrikkelenheter(searches[0].params, ctx());

      for (const id of ids.slice(0, 1)) {
        // Hent XML (hvis metoden finnes)
        if (typeof storeClient.getObjectXml === "function") {
          const xml = await storeClient.getObjectXml(id, "MatrikkelenhetId");
          expect(xml).toBeDefined();
          expect(xml.length).toBeGreaterThan(0);
        }
      }
    });

    it("skal finne seksjonsnummer i matrikkelnummer-strengen", async () => {
      const ids = await matrikkelClient.findMatrikkelenheter(searches[1].params, ctx());

      for (const id of ids.slice(0, 1)) {
        if (typeof storeClient.getObjectXml === "function") {
          const xml = await storeClient.getObjectXml(id, "MatrikkelenhetId");

          // Sok etter matrikkelnummer-format: 0301-73/704/0/2
          const matrikkelMatch = xml.match(
            /<matrikkelnummer[^>]*>([^<]+)<\/matrikkelnummer>/i
          );

          if (matrikkelMatch) {
            const mnr = matrikkelMatch[1];
            const parts = mnr.split(/[-/]/);

            console.log(`Matrikkelnummer: ${mnr}`);
            console.log(`Deler: [${parts.join(", ")}]`);

            // Hvis det er 5 deler, er del 5 seksjonsnummer
            if (parts.length >= 5) {
              const seksjonsnummer = parseInt(parts[4], 10);
              expect(seksjonsnummer).toBeGreaterThan(0);
            }
          }
        }
      }
    });
  });

  describe("XML-monstre for seksjonsdata", () => {
    const patterns = [
      { name: "matrikkelnummer", pattern: /<matrikkelnummer[^>]*>([^<]+)<\/matrikkelnummer>/i },
      { name: "seksjonsnummer", pattern: /<seksjonsnummer[^>]*>([^<]+)<\/seksjonsnummer>/i },
      { name: "eierseksjonsnummer", pattern: /<eierseksjonsnummer[^>]*>([^<]+)<\/eierseksjonsnummer>/i },
    ];

    it("regex-monstre skal vere gyldige", () => {
      patterns.forEach(({ name, pattern }) => {
        expect(pattern).toBeInstanceOf(RegExp);

        // Test mot eksempel-XML
        const testXml = `<${name}>test-value</${name}>`;
        const match = testXml.match(pattern);
        expect(match).not.toBeNull();
        expect(match?.[1]).toBe("test-value");
      });
    });
  });
});
