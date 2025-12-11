// Kjente testadresser med forventede resultater
// Brukes til E2E-tester og validering av bygningsvalg-logikk

export interface KnownAddress {
  address: string;
  fullAddress: string;
  expected: {
    gnr: number;
    bnr: number;
    bygningsnummer?: string;
    bruksarealM2?: number;
    seksjonsnummer?: number;
    byggeaar?: number;
  };
  description?: string;
}

/**
 * VALIDATED_ADDRESSES: Adresser med verifiserte Matrikkel-data
 * Disse brukes i strenge E2E-tester som asserterer på eksakte verdier.
 * GNR/BNR, bygningsnummer og andre felt er verifisert mot Kartverket.
 */
export const KNOWN_ADDRESSES = {
  // Kapellveien-adresser (seksjonert eiendom) - Verifisert mot Kartverket
  kapellveien156B: {
    address: "Kapellveien 156B",
    fullAddress: "Kapellveien 156B, 0493 Oslo",
    expected: {
      gnr: 73,
      bnr: 704,
      bygningsnummer: "80181503",
      seksjonsnummer: 1,
    },
    description: "Seksjon 1 av tomannsbolig",
  } as KnownAddress,

  kapellveien156C: {
    address: "Kapellveien 156C",
    fullAddress: "Kapellveien 156C, 0493 Oslo",
    expected: {
      gnr: 73,
      bnr: 704,
      bygningsnummer: "80181504",
      bruksarealM2: 159,
      seksjonsnummer: 2,
      byggeaar: 2013,
    },
    description: "Seksjon 2 av tomannsbolig - skal returnere 159 m2, ikke 279 m2",
  } as KnownAddress,

  // Fallanveien (borettslag) - Verifisert mot Kartverket
  fallanveien29: {
    address: "Fallanveien 29",
    fullAddress: "Fallanveien 29, 0495 Oslo",
    expected: {
      gnr: 75,
      bnr: 812,
      bygningsnummer: "80190816",
    },
    description: "Borettslag med flere bygninger",
  } as KnownAddress,
};

/**
 * UNVALIDATED_ADDRESSES: Adresser som brukes i tester med løse forventninger
 * GNR/BNR og andre felt er IKKE verifisert mot Matrikkel-data.
 * Tester som bruker disse bør kun sjekke at verdier er definert,
 * ikke assertere på eksakte verdier.
 */
export const UNVALIDATED_ADDRESSES = {
  // Kjelsasveien - BNR ikke verifisert (satt til 0 som placeholder)
  kjelsasveien97B: {
    address: "Kjelsasveien 97B",
    fullAddress: "Kjelsasveien 97B, 0491 Oslo",
    expected: {
      gnr: 73, // Verifisert
      bnr: 0, // IKKE VERIFISERT - placeholder
      bygningsnummer: "80181591", // Bør verifiseres
      seksjonsnummer: 2,
    },
    description: "Seksjon 2 med forventet BRA 95 m2 (92+3) - BNR må verifiseres",
  } as KnownAddress,

  // Hesteskoen-adresser - GNR/BNR IKKE verifisert (satt til 0 som placeholder)
  hesteskoen4A: {
    address: "Hesteskoen 4A",
    fullAddress: "Hesteskoen 4A, Oslo",
    expected: {
      gnr: 0, // IKKE VERIFISERT - placeholder
      bnr: 0, // IKKE VERIFISERT - placeholder
    },
    description: "Baseline-seksjon for sammenligning - GNR/BNR må verifiseres",
  } as KnownAddress,

  hesteskoen4L: {
    address: "Hesteskoen 4L",
    fullAddress: "Hesteskoen 4L, Oslo",
    expected: {
      gnr: 0, // IKKE VERIFISERT - placeholder
      bnr: 0, // IKKE VERIFISERT - placeholder
    },
    description: "Skal ha samme matrikkelenhet som 4A - GNR/BNR må verifiseres",
  } as KnownAddress,

  hesteskoen4M: {
    address: "Hesteskoen 4M",
    fullAddress: "Hesteskoen 4M, Oslo",
    expected: {
      gnr: 0, // IKKE VERIFISERT - placeholder
      bnr: 0, // IKKE VERIFISERT - placeholder
    },
    description: "Skal ha samme matrikkelenhet som 4A - GNR/BNR må verifiseres",
  } as KnownAddress,

  // Lyseveien - GNR/BNR IKKE verifisert (satt til 0 som placeholder)
  lyseveien3: {
    address: "Lyseveien 3",
    fullAddress: "Lyseveien 3, Oslo",
    expected: {
      gnr: 0, // IKKE VERIFISERT - placeholder
      bnr: 0, // IKKE VERIFISERT - placeholder
    },
    description: "Test av energiattest-oppslag - GNR/BNR må verifiseres",
  } as KnownAddress,
};

// Adresser fra residential-building-cache for bygningsvalg-testing
export const BUILDING_SELECTION_TEST_ADDRESSES = [
  "Dammanns vei 13",
  "Bygdoy terrasse 16",
  "Stromsborgveien 55B",
  "Christian Benneches vei 4C",
  "Bygdoylund 2",
  "Bygdoylund 9",
  "Museumsveien 7B",
  "Hengsengveien 1",
  "Huk aveny 12A",
  "Stromsborgveien 27",
];

// Eksporter kun verifiserte adresser for strenge tester
export function getAllValidatedAddresses(): KnownAddress[] {
  return Object.values(KNOWN_ADDRESSES);
}

// Eksporter alle adresser (inkl. uverifiserte) for løse tester
export function getAllKnownAddresses(): KnownAddress[] {
  return [...Object.values(KNOWN_ADDRESSES), ...Object.values(UNVALIDATED_ADDRESSES)];
}
