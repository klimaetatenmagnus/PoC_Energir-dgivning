// Konsolidert test for Kjelsasveien 97B
// Migrert fra:
// - scripts/test-kjelsasveien-summary.ts
// - scripts/test-kjelsasveien-97b-complete.ts
// - scripts/test-kjelsasveien-seksjon2.ts
//
// MERK: Denne adressen bruker UNVALIDATED_ADDRESSES fordi BNR ikke er verifisert.
// Testene bruker derfor løse forventninger (sjekker at verdier er definert)
// i stedet for å assertere på eksakte GNR/BNR-verdier.

import { describe, it, expect, beforeAll } from "vitest";
import { resolveBuildingData } from "../../../services/building-info-service/index.ts";
import { UNVALIDATED_ADDRESSES } from "../../fixtures/addresses.ts";

const LIVE = process.env.LIVE === "1";

describe.skipIf(!LIVE)("Kjelsasveien 97B - Seksjon 2", () => {
  let result: Awaited<ReturnType<typeof resolveBuildingData>>;

  beforeAll(async () => {
    result = await resolveBuildingData(UNVALIDATED_ADDRESSES.kjelsasveien97B.fullAddress);
  });

  describe("Grunnleggende data", () => {
    it("skal ha gyldig matrikkelenhets-ID", () => {
      expect(result.matrikkelenhetsId).toBeDefined();
      expect(result.matrikkelenhetsId).toBeGreaterThan(0);
    });

    it("skal ha gyldig bygg-ID", () => {
      expect(result.byggId).toBeDefined();
      expect(result.byggId).toBeGreaterThan(0);
    });

    it("skal ha gyldig bygningsnummer", () => {
      expect(result.bygningsnummer).toBeDefined();
      expect(result.bygningsnummer).toMatch(/^\d{8}$/);
    });

    it("skal ha byggeaar", () => {
      expect(result.byggeaar).toBeDefined();
      expect(result.byggeaar).toBeGreaterThan(1800);
      expect(result.byggeaar).toBeLessThanOrEqual(new Date().getFullYear());
    });
  });

  describe("Seksjonshåndtering", () => {
    it("skal identifisere seksjonsnummer 2", () => {
      expect(result.seksjonsnummer).toBe(2);
    });

    it("skal ha bruksareal rundt 95 m2 (92+3)", () => {
      // Forventet BRA for seksjon 2: ca. 95 m2
      expect(result.bruksarealM2).toBeDefined();
      // Tillat noe variasjon
      if (result.bruksarealM2) {
        expect(result.bruksarealM2).toBeGreaterThan(80);
        expect(result.bruksarealM2).toBeLessThan(120);
      }
    });
  });

  describe("Bygningstype", () => {
    it("skal ha bygningstype", () => {
      expect(result.bygningstype).toBeDefined();
    });

    it("skal ha bygningstypeKode", () => {
      expect(result.bygningstypeKode).toBeDefined();
    });
  });

  describe("Energiattest", () => {
    it("skal sjekke om energiattest finnes", () => {
      // Energiattest er valgfritt, men strukturen skal vare riktig hvis den finnes
      if (result.energiattest) {
        expect(result.energiattest.energiattest).toBeDefined();
        if (result.energiattest.energiattest) {
          expect(result.energiattest.energiattest.energikarakter).toBeDefined();
          expect(result.energiattest.energiattest.oppvarmingskarakter).toBeDefined();
        }
      }
    });
  });

  describe("Dataflyt-validering", () => {
    it("skal ha konsistente data", () => {
      // Verifiser at alle felt har rimelige verdier
      expect(result.gnr).toBeDefined();
      expect(result.bnr).toBeDefined();
      expect(result.matrikkelenhetsId).toBeGreaterThan(0);
      expect(result.byggId).toBeGreaterThan(0);

      // Verifiser at relaterte felt er konsistente
      if (result.seksjonsnummer !== undefined) {
        expect(result.seksjonsnummer).toBeGreaterThan(0);
      }
      if (result.byggeaar !== undefined) {
        expect(result.byggeaar).toBeGreaterThan(1800);
        expect(result.byggeaar).toBeLessThanOrEqual(new Date().getFullYear());
      }
      if (result.bruksarealM2 !== undefined) {
        expect(result.bruksarealM2).toBeGreaterThan(0);
      }
    });
  });
});
