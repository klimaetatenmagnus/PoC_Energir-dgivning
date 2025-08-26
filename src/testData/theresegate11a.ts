// Test data for Thereses gate 11A - Blokkleilighet
export const THERESES_11A_DATA = {
  buildingData: {
    adresse: "Thereses gate 11A, 0358 OSLO",
    gnr: 215,
    bnr: 156,
    seksjonsnummer: 12,
    bruksarealM2: 85,
    totalBygningsareal: 2400,
    byggeaar: 1895,
    bygningstype: "Blokkleilighet",
    bygningstypeKode: "143",
    bygningstypeKodeId: 10,
    bygningsnummer: "300431548",
    matrikkelenhetsId: 286145632,
    byggId: 300431548,
    rapporteringsNivaa: "leilighet",
    representasjonspunkt: {
      east: 598234.5,
      north: 6643567.8,
      epsg: "EPSG:25833"
    },
    takAreal_m2: 450,
    sol_kwh_m2_yr: 720,
    sol_kwh_bygg_tot: 324000,
    solKategori: "Middels egnet",
    takflater: [
      {
        tak_id: 1,
        bygg_id: 300431548,
        area_m2: 225,
        irr_kwh_m2_yr: 820,
        kWh_tot: 184500
      },
      {
        tak_id: 2,
        bygg_id: 300431548,
        area_m2: 225,
        irr_kwh_m2_yr: 620,
        kWh_tot: 139500
      }
    ],
    filteredSolarEnergy: 32400, // Delt på antall leiligheter
    energiattest: {
      energikarakter: "F",
      oppvarmingskarakter: "RØD",
      utstedelsesdato: "2019-06-20",
      attestnummer: "AT987654",
      attestUrl: "https://www.energimerking.no/attestnr/AT987654",
      registering: {
        beregnetLevertEnergiTotaltkWh: 18500
      }
    },
    csvData: {
      byggeaar: "1895",
      bruksareal_totalt: "85",
      takflate_main: "450",
      vurdert_egnet_for_solceller: "Delvis",
      kwh_sol_tak_aar: "32400",
      kategori_sol: "Middels egnet",
      adresse: "Thereses gate 11A",
      gnr: "215",
      bnr: "156",
      bygningstype: "Blokkleilighet",
      bygningstypekode: "143",
      antall_etasjer: "5",
      antall_leiligheter: "20",
      heis: "Nei",
      verneStatus: "Bevaringsverdig",
      gulListe: "Ja"
    }
  },
  solarData: {
    id: 300431548,
    center_x: 598234.5,
    center_y: 6643567.8,
    usable_roof_area_m2: 450,
    total_irr_yr_kwh: 324000,
    avg_irr_m2_yr_kwh: 720,
    category: "Middels egnet",
    roof_complexity: "Kompleks",
    estimated_panels: 8, // Per leilighet andel
    estimated_capacity_kw: 2.8,
    annual_production_kwh: 2800,
    co2_savings_kg: 1400,
    payback_years: 12,
    subsidy_available: true,
    subsidy_amount: 8000,
    installation_cost_estimate: 35000, // Per leilighet andel
    annual_savings_nok: 4200,
    roof_orientations: [
      { direction: "Øst", percentage: 50, suitability: "Middels" },
      { direction: "Vest", percentage: 50, suitability: "Middels" }
    ],
    building_specific_notes: "Bygningen er bevaringsverdig. Solceller må godkjennes av Byantikvaren.",
    shared_installation: true,
    share_percentage: 5 // Leilighetens andel av taket
  },
  suggestions: [
    {
      id: "2",
      adresse: "Thereses gate 11A, 0358 OSLO",
      postnummer: "0358",
      poststed: "OSLO",
      kommunenummer: "0301",
      kommunenavn: "Oslo",
      fylkesnummer: "03",
      fylkesnavn: "Oslo"
    }
  ]
};

// Mock responses for API calls
export const THERESES_11A_MOCK_RESPONSES = {
  addressSuggestions: {
    suggestions: THERESES_11A_DATA.suggestions
  },
  buildingLookup: THERESES_11A_DATA.buildingData,
  solarData: THERESES_11A_DATA.solarData
};