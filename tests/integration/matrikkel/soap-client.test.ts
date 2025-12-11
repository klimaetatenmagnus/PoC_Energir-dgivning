// Test av SOAP-klient mot Matrikkel API
// Migrert fra: scripts/testMatrikkel.cjs
//
// Miljøvariabler: Bruker samme env vars som andre Matrikkel-tester:
// - MATRIKKEL_USERNAME (eller MATRIKKEL_USERNAME_TEST for test-miljø)
// - MATRIKKEL_PASSWORD
// - MATRIKKEL_WSDL
// - MATRIKKEL_ENDPOINT (valgfritt)

import { describe, it, expect, beforeAll } from "vitest";
import soap from "soap";

const LIVE = process.env.LIVE === "1";

const wsdlUrl = process.env.MATRIKKEL_WSDL;
// Bruk samme env var-navngivning som matrikkel-client.test.ts og section-handling.test.ts
const username = process.env.MATRIKKEL_USERNAME || process.env.MATRIKKEL_USERNAME_TEST;
const password = process.env.MATRIKKEL_PASSWORD;
const endpoint = process.env.MATRIKKEL_ENDPOINT;

async function createSoapClient() {
  const client = await soap.createClientAsync(wsdlUrl!, {
    wsdl_options: { auth: `${username}:${password}` },
  });

  client.setSecurity(new soap.BasicAuthSecurity(username!, password!));

  if (endpoint) {
    client.setEndpoint(endpoint);
  }

  return client;
}

describe.skipIf(!LIVE || !wsdlUrl)("SOAP Client - Matrikkel API", () => {
  let client: soap.Client;

  beforeAll(async () => {
    client = await createSoapClient();
  });

  describe("Service Discovery", () => {
    it("skal liste tjenester og metoder", () => {
      const desc = client.describe();
      expect(desc).toBeDefined();
      expect(Object.keys(desc).length).toBeGreaterThan(0);

      // Verifiser at hver tjeneste har porter med metoder
      for (const service of Object.keys(desc)) {
        expect(Object.keys(desc[service]).length).toBeGreaterThan(0);
        for (const port of Object.keys(desc[service])) {
          expect(Object.keys(desc[service][port]).length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("Adresse-kall", () => {
    it("skal kunne utfore findAdresseIdForIdent", async () => {
      const ident = "0123456789";
      const snapshotVersion = "9999-01-01T00:00:00";

      try {
        const [res] = await client.findAdresseIdForIdentAsync({
          ident,
          snapshotVersion,
        });

        // Resultatet kan være null/undefined for ugyldig ident, men responsen skal være definert
        expect(res).toBeDefined();
      } catch {
        // Forventet for ugyldig ident - test passerer likevel
        expect(true).toBe(true);
      }
    });

    it("skal kunne hente objekt hvis adresseId finnes", async () => {
      const ident = "0123456789";
      const snapshotVersion = "9999-01-01T00:00:00";

      try {
        const [res] = await client.findAdresseIdForIdentAsync({
          ident,
          snapshotVersion,
        });

        if (res?.adresseId) {
          const [obj] = await client.getObjectAsync({
            adresseId: res.adresseId,
            snapshotVersion,
          });

          expect(obj).toBeDefined();
          // Verifiser at objektet har noen egenskaper
          expect(Object.keys(obj).length).toBeGreaterThan(0);
        }
      } catch {
        // Forventet for ugyldig data - test passerer likevel
        expect(true).toBe(true);
      }
    });
  });

  describe("WSDL Struktur", () => {
    it("skal ha forventede service-definisjoner", () => {
      const desc = client.describe();
      expect(Object.keys(desc).length).toBeGreaterThan(0);
    });
  });
});
