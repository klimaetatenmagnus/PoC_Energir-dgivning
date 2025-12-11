// Konsolidert test for bygningsvalg-logikk
// Migrert fra:
// - scripts/test-improved-selection-refactored.ts
// - scripts/test-improved-comprehensive.ts
// - scripts/test-improved-filtering.ts
// - scripts/test-improved-with-env.ts
// - scripts/test-improved-building-selection.ts

import { describe, it, expect, beforeAll } from "vitest";
import { resolveBuildingData } from "../../../services/building-info-service/index.ts";
import {
  getExpectedBuildingNumber,
  getAllTestAddresses,
} from "../../fixtures/expected-results.ts";
import { BUILDING_SELECTION_TEST_ADDRESSES } from "../../fixtures/addresses.ts";

const LIVE = process.env.LIVE === "1";

interface ComparisonResult {
  address: string;
  expectedBuildingNumber: string | undefined;
  standardBuildingNumber: string | null;
  improvedBuildingNumber: string | null;
  standardMatch: boolean;
  improvedMatch: boolean;
  improvement: "better" | "worse" | "same";
  error?: string;
}

describe.skipIf(!LIVE)("Building Selection - Standard vs Improved", () => {
  describe("Sammenligning av valgmetoder", () => {
    const testAddresses = BUILDING_SELECTION_TEST_ADDRESSES;
    const results: ComparisonResult[] = [];

    beforeAll(async () => {
      for (const address of testAddresses) {
        const expectedBuildingNumber = getExpectedBuildingNumber(address);
        if (!expectedBuildingNumber) continue;

        const fullAddress = `${address}, Oslo`;
        let standardResult: string | null = null;
        let improvedResult: string | null = null;

        try {
          // Test med standard selection
          const standard = await resolveBuildingData(fullAddress, {
            useImprovedSelection: false,
          });
          standardResult = standard.bygningsnummer || null;

          // Kort pause mellom kall
          await new Promise((resolve) => setTimeout(resolve, 300));

          // Test med improved selection
          const improved = await resolveBuildingData(fullAddress, {
            useImprovedSelection: true,
          });
          improvedResult = improved.bygningsnummer || null;
        } catch {
          // Ignorer feil, registrer bare null-resultater
        }

        const standardMatch = standardResult === expectedBuildingNumber;
        const improvedMatch = improvedResult === expectedBuildingNumber;

        let improvement: ComparisonResult["improvement"] = "same";
        if (!standardMatch && improvedMatch) {
          improvement = "better";
        } else if (standardMatch && !improvedMatch) {
          improvement = "worse";
        }

        results.push({
          address,
          expectedBuildingNumber,
          standardBuildingNumber: standardResult,
          improvedBuildingNumber: improvedResult,
          standardMatch,
          improvedMatch,
          improvement,
        });

        // Delay for a unnga overbelastning
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    });

    it("improved selection skal ikke ha regresjoner", () => {
      const regressions = results.filter((r) => r.improvement === "worse");
      expect(regressions).toHaveLength(0);
    });

    it("improved selection skal gi like bra eller bedre resultater", () => {
      const improvements = results.filter((r) => r.improvement === "better").length;
      const same = results.filter((r) => r.improvement === "same").length;
      expect(improvements + same).toBeGreaterThanOrEqual(results.length * 0.9);
    });

    it("skal ha strukturelt gyldige resultater", () => {
      // Valider at vi har resultater å analysere
      expect(results.length).toBeGreaterThan(0);

      const improvements = results.filter((r) => r.improvement === "better").length;
      const regressions = results.filter((r) => r.improvement === "worse").length;
      const same = results.filter((r) => r.improvement === "same").length;

      // Strukturell invariant: alle resultater skal klassifiseres
      expect(improvements + regressions + same).toBe(results.length);

      const standardMatches = results.filter((r) => r.standardMatch).length;
      const improvedMatches = results.filter((r) => r.improvedMatch).length;

      // Invariant: improved skal være like bra eller bedre enn standard
      expect(improvedMatches).toBeGreaterThanOrEqual(standardMatches);

      // Invariant: ingen regresjoner (dekket av egen test, men dobbeltsjekk)
      expect(regressions).toBe(0);
    });
  });
});

describe.skipIf(!LIVE)("Building Selection - Spesialhåndtering", () => {
  describe("Stromsborgveien-adresser", () => {
    const stromsborgAddresses = [
      "Stromsborgveien 42, Oslo",
      "Stromsborgveien 55B, Oslo",
      "Stromsborgveien 30, Oslo",
      "Stromsborgveien 25, Oslo",
    ];

    it.each(stromsborgAddresses)("%s skal handteres korrekt", async (address) => {
      const result = await resolveBuildingData(address, { useImprovedSelection: true });
      expect(result.bygningsnummer).toBeDefined();
      expect(result.bruksarealM2).toBeGreaterThan(50);
    });
  });

  describe("Tomannsbolig-strategi", () => {
    const tomannsboligAddresses = [
      "Dorthes vei 12, Oslo",
      "Dorthes vei 14, Oslo",
      "Stromsborgveien 25, Oslo",
    ];

    it.each(tomannsboligAddresses)("%s skal velge hovedbolig", async (address) => {
      const result = await resolveBuildingData(address, { useImprovedSelection: true });
      expect(result.bygningstype).toBeDefined();
      // Tomannsbolig-typer
      expect(["12", "121", "122"]).toContain(result.bygningstypeKode?.substring(0, 3) || result.bygningstypeKode);
    });
  });

  describe("Storrelsefiltrering (>50m2)", () => {
    it("skal filtrere ut sma bygg", async () => {
      // Test en adresse som har flere bygg, inkludert sma
      const result = await resolveBuildingData("Kapellveien 156C, 0493 Oslo", {
        useImprovedSelection: true,
      });

      // Bruksareal skal vare over 50 m2 for hovedbolig
      expect(result.bruksarealM2).toBeGreaterThan(50);
    });
  });
});

describe.skipIf(!LIVE)("Building Selection - Batch Testing", () => {
  describe("Forste 20 testadresser", () => {
    const results: Array<{
      address: string;
      match: boolean;
      expected: string | undefined;
      actual: string | undefined;
    }> = [];

    beforeAll(async () => {
      const addresses = getAllTestAddresses().slice(0, 20);

      for (const address of addresses) {
        const expected = getExpectedBuildingNumber(address);
        if (!expected) continue;

        try {
          const result = await resolveBuildingData(`${address}, Oslo`, {
            useImprovedSelection: true,
          });

          results.push({
            address,
            match: result.bygningsnummer === expected,
            expected,
            actual: result.bygningsnummer,
          });
        } catch {
          results.push({
            address,
            match: false,
            expected,
            actual: undefined,
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    });

    it("skal ha over 80% match-rate", () => {
      const matches = results.filter((r) => r.match).length;
      const matchRate = matches / results.length;
      expect(matchRate).toBeGreaterThan(0.8);
    });

    it("skal ha gyldige resultater med forventede felter", () => {
      // Valider strukturelle invarianter
      expect(results.length).toBeGreaterThan(0);

      const matches = results.filter((r) => r.match).length;
      const mismatches = results.filter((r) => !r.match);

      // Alle resultater skal ha forventede felter
      results.forEach((r) => {
        expect(r.address).toBeDefined();
        expect(typeof r.match).toBe("boolean");
        expect(r.expected).toBeDefined();
        // actual kan være undefined ved feil, men feltet skal eksistere
        expect("actual" in r).toBe(true);
      });

      // Verifiser at matches + mismatches = totalt
      expect(matches + mismatches.length).toBe(results.length);
    });
  });
});
