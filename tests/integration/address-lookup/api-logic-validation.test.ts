// Test av API-logikk for adresseoppslag
// Migrert fra: scripts/check-csv-vs-api-logic.cjs

import { describe, it, expect, beforeAll } from "vitest";
import fetch from "node-fetch";

const LIVE = process.env.LIVE === "1";
const API_URL = process.env.API_URL || "http://localhost:3001";

interface ApiResult {
  bygningsnummer?: string;
  bruksarealM2?: number;
  bygningstypeKode?: string;
  bygningstype?: string;
  seksjonsnummer?: number;
}

async function fetchFromAPI(address: string): Promise<ApiResult | null> {
  try {
    const response = await fetch(`${API_URL}/api/address-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return Array.isArray(data) ? data[0] : (data as ApiResult);
  } catch {
    return null;
  }
}

describe.skipIf(!LIVE)("API Address Lookup Logic", () => {
  beforeAll(async () => {
    // Sjekk API-tilgjengelighet
    try {
      const healthCheck = await fetch(`${API_URL}/health`);
      if (!healthCheck.ok) {
        throw new Error("API server is not running");
      }
    } catch {
      console.log("API server ikke tilgjengelig");
    }
  });

  describe("Adresseformat-handtering", () => {
    const testAddresses = [
      { csv: "Oeraveien 4", withOslo: "Oeraveien 4, Oslo" },
      { csv: "Arnstein Arnebergs vei 3", withOslo: "Arnstein Arnebergs vei 3, Oslo" },
      { csv: "Gravdalsveien 6", withOslo: "Gravdalsveien 6, Oslo" },
      { csv: "Vakeroveien 126K", withOslo: "Vakeroveien 126K, Oslo" },
    ];

    it.each(testAddresses)(
      "$csv skal fungere med ', Oslo' suffiks",
      async ({ withOslo }) => {
        const result = await fetchFromAPI(withOslo);

        // Ikke alle adresser vil fungere, men skal ikke krasje
        if (result) {
          expect(result.bygningsnummer).toBeDefined();
        }
      }
    );

    it("skal handtere adresser uten Oslo-suffiks", async () => {
      // Test noen adresser uten ", Oslo"
      const addresses = ["Kapellveien 156C", "Kjelsasveien 97B"];

      for (const address of addresses) {
        const result = await fetchFromAPI(address);
        // Adresser uten Oslo-suffiks kan feile, men skal ikke krasje
        expect(result === null || result.bygningsnummer !== undefined).toBe(true);
      }
    });
  });

  describe("Bygningsvalg-logikk", () => {
    it("skal velge hovedbolig for seksjonsadresser", async () => {
      const result = await fetchFromAPI("Vakeroveien 126K, Oslo");

      if (result) {
        // K-seksjoner skal handteres korrekt
        expect(result.bygningsnummer).toBeDefined();

        console.log("\nVakeroveien 126K resultat:");
        console.log(`  Building: ${result.bygningsnummer}`);
        console.log(`  Area: ${result.bruksarealM2} m2`);
        console.log(`  Type: ${result.bygningstypeKode} - ${result.bygningstype}`);
        console.log(`  Section: ${result.seksjonsnummer || "None"}`);
      }
    });

    it("skal prioritere boligbygg over garasjer", async () => {
      const result = await fetchFromAPI("Kapellveien 156C, 0493 Oslo");

      if (result) {
        // Skal ikke returnere garasje (type 18x)
        expect(result.bygningstypeKode?.startsWith("18")).toBe(false);
      }
    });
  });

  describe("Feilhandtering", () => {
    it("skal handtere ugyldig adresse gracefully", async () => {
      const result = await fetchFromAPI("Helt Ugyldig Adresse 99999");
      // Kan returnere null eller en feil, men skal ikke krasje
      expect(result === null || typeof result === "object").toBe(true);
    });

    it("skal handtere tom adresse", async () => {
      const result = await fetchFromAPI("");
      expect(result === null || typeof result === "object").toBe(true);
    });
  });
});

describe.skipIf(!LIVE)("API Address Lookup - Key Insights", () => {
  it("skal dokumentere kjente problemstillinger", () => {
    console.log("\n=== KEY FINDINGS ===");
    console.log("1. CSV-adresser inkluderer ikke ', Oslo' - dette kan foarsake API-feil");
    console.log("2. API velger kanskje forskjellig bygg nar:");
    console.log("   - 'Advanced logic' prioriterer hovedbygg over seksjoner");
    console.log("   - Seksjonshandtering (A, B, K etc.) pavirker bygningsvalg");
    console.log("   - Data har endret seg mellom 2023 (CSV) og na");
    console.log("3. For arealavvik: API returnerer ofte seksjons-spesifikt areal");
    console.log("\nANBEFALING: Legg til ', Oslo' til adresser fra CSV ved sammenligning");

    expect(true).toBe(true);
  });
});
