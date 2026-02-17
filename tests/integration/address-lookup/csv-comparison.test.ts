// Test av CSV vs API sammenligning
// Migrert fra: scripts/compare-spreadsheet-api.cjs

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";

const LIVE = process.env.LIVE === "1";
const API_URL = process.env.API_URL || "http://localhost:3001";

interface CsvRecord {
  GateAdresse: string;
  BYGNINGS_NR: string;
  BRUKSAREAL_TOTALT: string;
  Bygningstype: string;
}

interface ApiResult {
  bygningsnummer?: string;
  bruksarealM2?: number;
  bygningstypeKode?: string;
  bygningstype?: string;
  seksjonsnummer?: number;
}

interface ComparisonResult {
  total: number;
  foundInAPI: number;
  notFoundInAPI: number;
  perfectMatch: number;
  differentBuilding: number;
  differentArea: number;
  differentType: number;
}

async function fetchFromAPI(address: string): Promise<ApiResult[]> {
  try {
    const response = await fetch(`${API_URL}/api/address-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data as ApiResult];
  } catch {
    return [];
  }
}

function parseCSV(content: string): CsvRecord[] {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim().replace(/"/g, ""));
  const records: CsvRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(";").map((v) => v.trim().replace(/"/g, ""));
    if (values.length !== headers.length) continue;

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index];
    });

    // Kun boligbygg (type 11-17)
    const buildingType = record.Bygningstype?.substring(0, 2);
    if (["11", "12", "13", "14", "15", "16", "17"].includes(buildingType)) {
      records.push(record as unknown as CsvRecord);
    }
  }

  return records;
}

describe.skipIf(!LIVE)("CSV vs API Comparison", () => {
  let csvRecords: CsvRecord[] = [];
  const csvPath = path.join(process.cwd(), "data", "raw", "matrikkel_bygg_2025.csv");

  beforeAll(async () => {
    // Sjekk API-helsesjekk
    try {
      const healthCheck = await fetch(`${API_URL}/health`);
      if (!healthCheck.ok) {
        throw new Error("API server is not running");
      }
    } catch {
      console.log("API server ikke tilgjengelig, hopper over tester");
      return;
    }

    // Last CSV hvis den finnes
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, "utf-8");
      csvRecords = parseCSV(content);
    }
  });

  describe("Spesifikke kjente adresser", () => {
    const testAddresses = [
      { address: "Lille Froens vei 1A, 0371 Oslo", expectedBuilding: "80110219" },
      { address: "Kapellveien 156B, 0493 Oslo", expectedBuilding: "80181503" },
      { address: "Kjelsasveien 97B, 0491 Oslo", expectedBuilding: "80181591" },
    ];

    it.each(testAddresses)(
      "$address skal returnere bygningsnummer",
      async ({ address }) => {
        const apiResults = await fetchFromAPI(address);
        expect(apiResults.length).toBeGreaterThan(0);

        if (apiResults.length > 0) {
          expect(apiResults[0].bygningsnummer).toBeDefined();
        }
      }
    );
  });

  describe("Tilfeldig utvalg fra CSV", () => {
    it("skal sammenligne 10 tilfeldige adresser", async () => {
      if (csvRecords.length === 0) {
        console.log("Ingen CSV-data tilgjengelig");
        return;
      }

      const sampleSize = 10;
      const sampled = csvRecords.sort(() => Math.random() - 0.5).slice(0, sampleSize);

      const results: ComparisonResult = {
        total: 0,
        foundInAPI: 0,
        notFoundInAPI: 0,
        perfectMatch: 0,
        differentBuilding: 0,
        differentArea: 0,
        differentType: 0,
      };

      for (const record of sampled) {
        results.total++;
        const address = `${record.GateAdresse}, Oslo`;
        const apiResults = await fetchFromAPI(address);

        if (apiResults.length === 0) {
          results.notFoundInAPI++;
        } else {
          results.foundInAPI++;
          const api = apiResults[0];

          let isPerfectMatch = true;

          if (record.BYGNINGS_NR !== api.bygningsnummer) {
            results.differentBuilding++;
            isPerfectMatch = false;
          }

          const csvArea = parseInt(record.BRUKSAREAL_TOTALT) || 0;
          if (api.bruksarealM2 && Math.abs(csvArea - api.bruksarealM2) > 1) {
            results.differentArea++;
            isPerfectMatch = false;
          }

          if (isPerfectMatch) {
            results.perfectMatch++;
          }
        }

        // Kort pause mellom kall
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      console.log("\n=== CSV vs API COMPARISON ===");
      console.log(`Total: ${results.total}`);
      console.log(`Found in API: ${results.foundInAPI}`);
      console.log(`Not found: ${results.notFoundInAPI}`);
      console.log(`Perfect match: ${results.perfectMatch}`);
      console.log(`Different building: ${results.differentBuilding}`);
      console.log(`Different area: ${results.differentArea}`);

      // Forvent at minst 50% finnes i API
      expect(results.foundInAPI / results.total).toBeGreaterThan(0.5);
    });
  });
});
