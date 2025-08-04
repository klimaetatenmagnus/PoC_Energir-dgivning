// Test data for Lyseveien 3 - for demo purposes without API calls
export const LYSEVEIEN_3_DATA = {
  buildingData: {
    adresse: "Lyseveien 3, 0362 OSLO",
    gnr: 33,
    bnr: 1139,
    seksjonsnummer: undefined,
    bruksarealM2: 150,
    totalBygningsareal: 150,
    byggeaar: 1984,
    bygningstype: "Enebolig",
    bygningstypeKode: "111",
    bygningstypeKodeId: 1,
    bygningsnummer: "80089296",
    matrikkelenhetsId: 286103642,
    byggId: 80089296,
    rapporteringsNivaa: "bygning",
    representasjonspunkt: {
      east: 593748.5,
      north: 6646814.5,
      epsg: "EPSG:25833"
    },
    takAreal_m2: 120,
    sol_kwh_m2_yr: 850,
    sol_kwh_bygg_tot: 102000,
    solKategori: "Godt egnet",
    takflater: [
      {
        tak_id: 1,
        bygg_id: 80089296,
        area_m2: 60,
        irr_kwh_m2_yr: 950,
        kWh_tot: 57000
      },
      {
        tak_id: 2,
        bygg_id: 80089296,
        area_m2: 60,
        irr_kwh_m2_yr: 750,
        kWh_tot: 45000
      }
    ],
    filteredSolarEnergy: 85000,
    energiattest: {
      energikarakter: "E",
      oppvarmingskarakter: "RØD",
      utstedelsesdato: "2020-01-15",
      attestnummer: "AT123456",
      attestUrl: "https://www.energimerking.no/attestnr/AT123456",
      registering: {
        beregnetLevertEnergiTotaltkWh: 25000
      }
    },
    csvData: {
      byggeaar: "1984",
      bruksareal_totalt: "150",
      takflate_main: "120",
      vurdert_egnet_for_solceller: "Ja",
      kwh_sol_tak_aar: "102000",
      kategori_sol: "Godt egnet",
      adresse: "Lyseveien 3",
      gnr: "33",
      bnr: "1139",
      bygningstype: "Enebolig",
      bygningstypekode: "111"
    }
  },
  solarData: {
    id: 80089296,
    center_x: 593748.5,
    center_y: 6646814.5,
    usable_roof_area_m2: 120,
    total_irr_yr_kwh: 102000,
    avg_irr_m2_yr_kwh: 850,
    category: "Godt egnet",
    roof_complexity: "Middels",
    estimated_panels: 30,
    estimated_capacity_kw: 10.5,
    annual_production_kwh: 10500,
    co2_savings_kg: 5250,
    payback_years: 8,
    subsidy_available: true,
    subsidy_amount: 15000,
    installation_cost_estimate: 125000,
    annual_savings_nok: 15750,
    roof_orientations: [
      { direction: "Sør", percentage: 60, suitability: "Utmerket" },
      { direction: "Vest", percentage: 40, suitability: "God" }
    ]
  },
  suggestions: [
    {
      id: "1",
      adresse: "Lyseveien 3, 0362 OSLO",
      postnummer: "0362",
      poststed: "OSLO",
      kommunenummer: "0301",
      kommunenavn: "Oslo",
      fylkesnummer: "03",
      fylkesnavn: "Oslo"
    }
  ]
};

// Mock responses for API calls
export const LYSEVEIEN_3_MOCK_RESPONSES = {
  addressSuggestions: {
    suggestions: LYSEVEIEN_3_DATA.suggestions
  },
  buildingLookup: LYSEVEIEN_3_DATA.buildingData,
  solarData: LYSEVEIEN_3_DATA.solarData
};