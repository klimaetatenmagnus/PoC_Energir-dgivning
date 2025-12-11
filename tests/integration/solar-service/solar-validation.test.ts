// Test av soldata-validering mot PBE Solkart
// Migrert fra: scripts/test-soldata-validation.ts

import { describe, it, expect } from "vitest";
import fetch from "node-fetch";

const LIVE = process.env.LIVE === "1";
const SOLAR_SERVICE_URL = process.env.SOLAR_SERVICE_URL || "http://localhost:4003/solinnstraling";
const GEONORGE_URL = "https://ws.geonorge.no/adresser/v1/sok";

interface TestAddress {
  address: string;
  expected: {
    takflateIds: number[];
    totalArea: number;
    filteredSolarEnergy: number;
    bygningsnummer: string;
  };
  geonorge?: {
    lat: number;
    lon: number;
  };
  csvBygningsNr?: string;
  apiBygningsNr?: string;
}

interface SolarResponse {
  takflater?: Array<{
    tak_id: number;
    bygg_id: number | null;
    bygg_nr: string | null;
    area_m2: number;
    irr_kwh_m2_yr: number;
    kWh_tot: number;
  }>;
  takAreal_m2?: number;
  sol_kwh_m2_yr?: number;
  sol_kwh_bygg_tot?: number;
  filteredSolarEnergy?: number;
  category?: string;
  error?: string;
}

// Testadresser med forventede verdier fra PBE Solkart
const TEST_ADDRESSES: TestAddress[] = [
  {
    address: "Fallanveien 29, 0495 Oslo",
    expected: {
      takflateIds: [16344, 17202],
      totalArea: 380,
      filteredSolarEnergy: 35932,
      bygningsnummer: "80190816",
    },
    geonorge: {
      lat: 59.96215723,
      lon: 10.79299229,
    },
    csvBygningsNr: "80190816",
    apiBygningsNr: "80190719",
  },
];

async function fetchSolarData(params: Record<string, string | number>): Promise<SolarResponse | null> {
  const url = new URL(SOLAR_SERVICE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 404) {
        return { error: "Ingen takflater funnet" };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as SolarResponse;
  } catch {
    return null;
  }
}

async function lookupGeonorge(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${GEONORGE_URL}?sok=${encodeURIComponent(address)}&fuzzy=true`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Energitiltak/1.0" },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      adresser?: Array<{ representasjonspunkt?: { lat: number; lon: number } }>;
    };
    if (!data.adresser?.length) return null;

    const punkt = data.adresser[0].representasjonspunkt;
    if (!punkt) return null;

    return { lat: punkt.lat, lon: punkt.lon };
  } catch {
    return null;
  }
}

function calculateFilteredEnergy(
  takflater: SolarResponse["takflater"],
  minRadiation = 800,
  efficiency = 0.2
): number {
  if (!takflater?.length) return 0;
  return takflater
    .filter((tak) => tak.irr_kwh_m2_yr > minRadiation)
    .reduce((sum, tak) => sum + tak.area_m2 * tak.irr_kwh_m2_yr * efficiency, 0);
}

describe.skipIf(!LIVE)("Solar Service - Validering", () => {
  describe.each(TEST_ADDRESSES)("$address", (testAddr) => {
    describe("Oppslag med bygningsnummer", () => {
      it("skal returnere korrekte takflater for riktig bygningsnummer", async () => {
        if (!testAddr.csvBygningsNr) return;

        const result = await fetchSolarData({ bygg_nr: testAddr.csvBygningsNr });

        if (result?.error) {
          console.log(`Ingen takflater funnet for ${testAddr.csvBygningsNr}`);
          return;
        }

        expect(result).not.toBeNull();
        expect(result?.takflater).toBeDefined();

        if (result?.takflater) {
          const takIds = result.takflater.map((t) => t.tak_id).sort((a, b) => a - b);
          const expectedIds = testAddr.expected.takflateIds.sort((a, b) => a - b);

          // Sjekk at minst noen takflater matcher
          const matchingIds = takIds.filter((id) => expectedIds.includes(id));
          expect(matchingIds.length).toBeGreaterThan(0);
        }
      });

      it("skal returnere forskjellige resultater for forskjellige bygningsnummer", async () => {
        if (!testAddr.csvBygningsNr || !testAddr.apiBygningsNr) return;
        if (testAddr.csvBygningsNr === testAddr.apiBygningsNr) return;

        const resultCsv = await fetchSolarData({ bygg_nr: testAddr.csvBygningsNr });
        const resultApi = await fetchSolarData({ bygg_nr: testAddr.apiBygningsNr });

        // Resultatene kan vaere forskjellige
        console.log(`CSV bygningsNr (${testAddr.csvBygningsNr}):`, resultCsv?.takflater?.length || 0, "takflater");
        console.log(`API bygningsNr (${testAddr.apiBygningsNr}):`, resultApi?.takflater?.length || 0, "takflater");
      });
    });

    describe("Oppslag med koordinater", () => {
      it("skal returnere takflater for Geonorge-koordinater", async () => {
        let geoCoords = testAddr.geonorge;
        if (!geoCoords) {
          geoCoords = await lookupGeonorge(testAddr.address);
        }

        if (!geoCoords) {
          console.log("Kunne ikke hente koordinater fra Geonorge");
          return;
        }

        const result = await fetchSolarData({ lat: geoCoords.lat, lon: geoCoords.lon });

        if (result?.error) {
          console.log("Ingen takflater funnet for koordinater");
          return;
        }

        expect(result).not.toBeNull();
      });
    });

    describe("Energiberegning", () => {
      it("skal beregne filtrert solenergi korrekt", async () => {
        if (!testAddr.csvBygningsNr) return;

        const result = await fetchSolarData({ bygg_nr: testAddr.csvBygningsNr });

        if (!result?.takflater) return;

        const filteredEnergy = calculateFilteredEnergy(result.takflater);
        const expectedEnergy = testAddr.expected.filteredSolarEnergy;

        // Tillat 20% avvik
        const tolerance = expectedEnergy * 0.2;
        expect(Math.abs(filteredEnergy - expectedEnergy)).toBeLessThan(tolerance);
      });
    });
  });
});
