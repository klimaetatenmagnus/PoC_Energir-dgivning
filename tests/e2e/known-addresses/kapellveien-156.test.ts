// Konsolidert test for Kapellveien 156B og 156C
// Migrert fra:
// - scripts/test-kapellveien-156c-focused.ts
// - scripts/test-kapellveien-156c-detailed.ts
// - scripts/test-kapellveien-sections.ts
// - scripts/test-kapellveien-seksjoner.ts
// - scripts/verify-kapellveien-156c.ts
// - scripts/verify-kapellveien-total.ts

import { describe, it, expect, beforeAll } from "vitest";
import { resolveBuildingData } from "../../../services/building-info-service/index.ts";
import { KNOWN_ADDRESSES } from "../../fixtures/addresses.ts";

const LIVE = process.env.LIVE === "1";

describe.skipIf(!LIVE)("Kapellveien 156 - Seksjonert eiendom", () => {
  describe("156B - Seksjon 1", () => {
    let result: Awaited<ReturnType<typeof resolveBuildingData>>;

    beforeAll(async () => {
      result = await resolveBuildingData(KNOWN_ADDRESSES.kapellveien156B.fullAddress);
    });

    it("skal returnere korrekt GNR/BNR", () => {
      expect(result.gnr).toBe(KNOWN_ADDRESSES.kapellveien156B.expected.gnr);
      expect(result.bnr).toBe(KNOWN_ADDRESSES.kapellveien156B.expected.bnr);
    });

    it("skal identifisere seksjonsnummer 1", () => {
      expect(result.seksjonsnummer).toBe(KNOWN_ADDRESSES.kapellveien156B.expected.seksjonsnummer);
    });

    it("skal ha gyldig bygningsnummer", () => {
      expect(result.bygningsnummer).toBeDefined();
      expect(result.bygningsnummer).toMatch(/^\d{8}$/);
    });
  });

  describe("156C - Seksjon 2", () => {
    let result: Awaited<ReturnType<typeof resolveBuildingData>>;

    beforeAll(async () => {
      result = await resolveBuildingData(KNOWN_ADDRESSES.kapellveien156C.fullAddress);
    });

    it("skal returnere korrekt GNR/BNR", () => {
      expect(result.gnr).toBe(KNOWN_ADDRESSES.kapellveien156C.expected.gnr);
      expect(result.bnr).toBe(KNOWN_ADDRESSES.kapellveien156C.expected.bnr);
    });

    it("skal identifisere seksjonsnummer 2", () => {
      expect(result.seksjonsnummer).toBe(KNOWN_ADDRESSES.kapellveien156C.expected.seksjonsnummer);
    });

    it("skal returnere korrekt bruksareal (159 m2, ikke 279 m2)", () => {
      // Kritisk test: 279 m2 er hele bygget, 159 m2 er seksjonen
      expect(result.bruksarealM2).toBe(KNOWN_ADDRESSES.kapellveien156C.expected.bruksarealM2);
      expect(result.bruksarealM2).not.toBe(279);
    });

    it("skal returnere korrekt byggear", () => {
      expect(result.byggeaar).toBe(KNOWN_ADDRESSES.kapellveien156C.expected.byggeaar);
    });

    it("skal ha gyldig bygningsnummer", () => {
      expect(result.bygningsnummer).toBeDefined();
      expect(result.bygningsnummer).toMatch(/^\d{8}$/);
    });
  });

  describe("156B og 156C - Sammenligning", () => {
    let resultB: Awaited<ReturnType<typeof resolveBuildingData>>;
    let resultC: Awaited<ReturnType<typeof resolveBuildingData>>;

    beforeAll(async () => {
      resultB = await resolveBuildingData(KNOWN_ADDRESSES.kapellveien156B.fullAddress);
      resultC = await resolveBuildingData(KNOWN_ADDRESSES.kapellveien156C.fullAddress);
    });

    it("skal ha samme matrikkelenhet (GNR/BNR)", () => {
      expect(resultB.gnr).toBe(resultC.gnr);
      expect(resultB.bnr).toBe(resultC.bnr);
    });

    it("skal ha forskjellige seksjonsnummer", () => {
      expect(resultB.seksjonsnummer).not.toBe(resultC.seksjonsnummer);
    });

    it("skal ha forskjellige bygningsnummer (separate bygg)", () => {
      // I seksjonerte eiendommer kan B og C referere til forskjellige bygg
      expect(resultB.bygningsnummer).not.toBe(resultC.bygningsnummer);
    });

    it("bruksareal skal ikke vere summen av begge seksjoner", () => {
      // Sjekk at hverken B eller C returnerer total areal (279 m2)
      const totalAreal = 279;
      expect(resultB.bruksarealM2).toBeLessThan(totalAreal);
      expect(resultC.bruksarealM2).toBeLessThan(totalAreal);
    });
  });
});
