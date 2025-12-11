// Konsolidert test for edge-cases og spesialadresser
// Migrert fra:
// - scripts/test-hesteskoen-4.ts
// - scripts/test-fallanveien.ts
// - scripts/test-enova-lyseveien.ts
//
// MERK: Noen adresser her (Hesteskoen, Lyseveien) bruker UNVALIDATED_ADDRESSES
// fordi GNR/BNR ikke er verifisert mot Matrikkel-data.
// Testene for disse bruker løse forventninger (sjekker at verdier er definert)
// i stedet for å assertere på eksakte GNR/BNR-verdier.

import { describe, it, expect, beforeAll } from "vitest";
import { resolveBuildingData } from "../../../services/building-info-service/index.ts";
import { KNOWN_ADDRESSES, UNVALIDATED_ADDRESSES } from "../../fixtures/addresses.ts";

const LIVE = process.env.LIVE === "1";

describe.skipIf(!LIVE)("Edge Cases - Spesielle adresser", () => {
  // Hesteskoen bruker UNVALIDATED_ADDRESSES - GNR/BNR er ikke verifisert.
  // Testene bruker relative sammenligninger (alle seksjoner skal ha SAMME verdier)
  // i stedet for å assertere på eksakte GNR/BNR-verdier.
  describe("Hesteskoen 4 - Flere seksjoner pa samme eiendom", () => {
    const addresses = ["Hesteskoen 4A, Oslo", "Hesteskoen 4L, Oslo", "Hesteskoen 4M, Oslo"];

    interface Summary {
      adresse: string;
      matrikkelenhetsId: number;
      byggId: number;
      bruksarealM2: number | null;
    }

    const results: Summary[] = [];

    beforeAll(async () => {
      for (const adresse of addresses) {
        const data = await resolveBuildingData(adresse);
        results.push({
          adresse,
          matrikkelenhetsId: data.matrikkelenhetsId,
          byggId: data.byggId,
          bruksarealM2: data.bruksarealM2,
        });
      }
    });

    it("skal returnere data for alle seksjoner", () => {
      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.matrikkelenhetsId).toBeGreaterThan(0);
        expect(r.byggId).toBeGreaterThan(0);
      });
    });

    it("alle seksjoner skal ha samme matrikkelenhet", () => {
      const baseline = results[0];
      results.slice(1).forEach((comparison) => {
        expect(comparison.matrikkelenhetsId).toBe(baseline.matrikkelenhetsId);
      });
    });

    it("alle seksjoner skal ha samme bygg-ID", () => {
      const baseline = results[0];
      results.slice(1).forEach((comparison) => {
        expect(comparison.byggId).toBe(baseline.byggId);
      });
    });

    it("alle seksjoner skal ha samme bruksareal", () => {
      const baseline = results[0];
      results.slice(1).forEach((comparison) => {
        expect(comparison.bruksarealM2).toBe(baseline.bruksarealM2);
      });
    });
  });

  describe("Fallanveien 29 - Borettslag med flere bygninger", () => {
    let result: Awaited<ReturnType<typeof resolveBuildingData>>;

    beforeAll(async () => {
      result = await resolveBuildingData(KNOWN_ADDRESSES.fallanveien29.fullAddress);
    });

    it("skal ha korrekt GNR/BNR", () => {
      expect(result.gnr).toBe(KNOWN_ADDRESSES.fallanveien29.expected.gnr);
      expect(result.bnr).toBe(KNOWN_ADDRESSES.fallanveien29.expected.bnr);
    });

    it("skal ha gyldig matrikkelenhets-ID", () => {
      expect(result.matrikkelenhetsId).toBeGreaterThan(0);
    });

    it("skal ha gyldig bygg-ID", () => {
      expect(result.byggId).toBeGreaterThan(0);
    });

    it("skal ha koordinater", () => {
      expect(result.coordinatesWgs84).toBeDefined();
      if (result.coordinatesWgs84) {
        expect(result.coordinatesWgs84.lat).toBeGreaterThan(59);
        expect(result.coordinatesWgs84.lon).toBeGreaterThan(10);
      }
    });

    it("skal ha byggeaar og bruksareal", () => {
      expect(result.byggeaar).toBeDefined();
      expect(result.bruksarealM2).toBeDefined();
    });
  });

  // Lyseveien bruker UNVALIDATED_ADDRESSES - kun løse forventninger (sjekker at verdier er definert)
  describe("Lyseveien 3 - Energiattest-oppslag", () => {
    let result: Awaited<ReturnType<typeof resolveBuildingData>>;

    beforeAll(async () => {
      result = await resolveBuildingData(UNVALIDATED_ADDRESSES.lyseveien3.fullAddress);
    });

    // MERK: GNR/BNR er ikke verifisert, sjekker kun at de er definert
    it("skal ha grunnleggende bygningsdata", () => {
      expect(result.gnr).toBeDefined();
      expect(result.bnr).toBeDefined();
      expect(result.matrikkelenhetsId).toBeGreaterThan(0);
    });

    it("skal ha byggeaar og bruksareal", () => {
      expect(result.byggeaar).toBeDefined();
      expect(result.bruksarealM2).toBeDefined();
    });

    it("skal ha bygningstype", () => {
      expect(result.bygningstype).toBeDefined();
      expect(result.bygningstypeKode).toBeDefined();
    });

    // Energiattest er valgfritt og avhenger av ENOVA_API_KEY
    it("energiattest-struktur skal vare korrekt hvis funnet", () => {
      if (result.energiattest && result.energiattest.energiattest) {
        expect(result.energiattest.energiattest.energikarakter).toBeDefined();
        expect(result.energiattest.energiattest.oppvarmingskarakter).toBeDefined();
      }
    });
  });
});

describe.skipIf(!LIVE)("Feiladresser og problematiske case", () => {
  describe("Adresser som tidligere har feilet", () => {
    const problematicAddresses = [
      "Lille Froens vei 1A, 0371 Oslo",
      "Vakeroveien 126K, Oslo",
    ];

    it.each(problematicAddresses)("skal handtere %s uten a kaste feil", async (address) => {
      await expect(resolveBuildingData(address)).resolves.toBeDefined();
    });

    it.each(problematicAddresses)("%s skal ha gyldig matrikkelenhets-ID", async (address) => {
      const result = await resolveBuildingData(address);
      expect(result.matrikkelenhetsId).toBeGreaterThan(0);
    });
  });

  describe("Adresser med spesialtegn", () => {
    const specialCharAddresses = [
      { address: "Kjelsasveien 97B, 0491 Oslo", description: "Norsk A" },
      { address: "Lochenveien 26, Oslo", description: "Norsk O" },
      { address: "P. T. Mallings vei 27A, Oslo", description: "Punktum og mellomrom" },
    ];

    it.each(specialCharAddresses)(
      "$address ($description) skal fungere",
      async ({ address }) => {
        const result = await resolveBuildingData(address);
        expect(result.matrikkelenhetsId).toBeGreaterThan(0);
      }
    );
  });
});
