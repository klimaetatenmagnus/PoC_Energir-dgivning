// Test data for Thereses gate 44A - Bygård/større boligbygg
export const THERESES_44A_DATA = {
  buildingData: {
    adresse: "Thereses gate 44A, 0168 OSLO",
    gnr: 215,
    bnr: 278,
    seksjonsnummer: undefined,
    bruksarealM2: 3200,
    totalBygningsareal: 3200,
    byggeaar: 1902,
    bygningstype: "Bygård",
    bygningstypeKode: "142",
    bygningstypeKodeId: 9,
    bygningsnummer: "300456789",
    matrikkelenhetsId: 286167890,
    byggId: 300456789,
    rapporteringsNivaa: "bygning",
    representasjonspunkt: {
      east: 598456.2,
      north: 6643234.7,
      epsg: "EPSG:25833"
    },
    takAreal_m2: 680,
    sol_kwh_m2_yr: 580,
    sol_kwh_bygg_tot: 394400,
    solKategori: "Mindre egnet",
    takflater: [
      {
        tak_id: 1,
        bygg_id: 300456789,
        area_m2: 340,
        irr_kwh_m2_yr: 650,
        kWh_tot: 221000
      },
      {
        tak_id: 2,
        bygg_id: 300456789,
        area_m2: 340,
        irr_kwh_m2_yr: 510,
        kWh_tot: 173400
      }
    ],
    filteredSolarEnergy: 394400,
    energiattest: {
      energikarakter: "G",
      oppvarmingskarakter: "RØD",
      utstedelsesdato: "2018-03-15",
      attestnummer: "AT456789",
      attestUrl: "https://www.energimerking.no/attestnr/AT456789",
      registering: {
        beregnetLevertEnergiTotaltkWh: 480000
      }
    },
    csvData: {
      byggeaar: "1902",
      bruksareal_totalt: "3200",
      takflate_main: "680",
      vurdert_egnet_for_solceller: "Nei",
      kwh_sol_tak_aar: "394400",
      kategori_sol: "Mindre egnet",
      adresse: "Thereses gate 44A",
      gnr: "215",
      bnr: "278",
      bygningstype: "Bygård",
      bygningstypekode: "142",
      antall_etasjer: "6",
      antall_leiligheter: "28",
      heis: "Ja",
      verneStatus: "Gul liste",
      gulListe: "Ja",
      fjernvarme: "Tilkoblet",
      oppvarming: "Fjernvarme og elektrisk"
    }
  },
  solarData: {
    id: 300456789,
    center_x: 598456.2,
    center_y: 6643234.7,
    usable_roof_area_m2: 680,
    total_irr_yr_kwh: 394400,
    avg_irr_m2_yr_kwh: 580,
    category: "Mindre egnet",
    roof_complexity: "Svært kompleks",
    estimated_panels: 60,
    estimated_capacity_kw: 21,
    annual_production_kwh: 21000,
    co2_savings_kg: 10500,
    payback_years: 18,
    subsidy_available: false, // Ikke støtte pga vernestatus
    subsidy_amount: 0,
    installation_cost_estimate: 525000,
    annual_savings_nok: 31500,
    roof_orientations: [
      { direction: "Nord", percentage: 40, suitability: "Dårlig" },
      { direction: "Sør", percentage: 30, suitability: "God" },
      { direction: "Øst", percentage: 15, suitability: "Middels" },
      { direction: "Vest", percentage: 15, suitability: "Middels" }
    ],
    building_specific_notes: "Bygningen står på gul liste. Omfattende tiltak krever godkjenning fra Byantikvaren. Takgeometrien og skyggelegging gjør solceller mindre egnet.",
    shared_installation: true,
    share_percentage: 100, // Hele bygningen
    shading_issues: true,
    shading_description: "Betydelig skyggelegging fra nabobygg og trær",
    heritage_restrictions: true,
    heritage_description: "Gul liste - verneverdig bygning. Synlige installasjoner må godkjennes."
  },
  suggestions: [
    {
      id: "3",
      adresse: "Thereses gate 44A, 0168 OSLO",
      postnummer: "0168",
      poststed: "OSLO",
      kommunenummer: "0301",
      kommunenavn: "Oslo",
      fylkesnummer: "03",
      fylkesnavn: "Oslo"
    }
  ]
};

// Mock responses for API calls
export const THERESES_44A_MOCK_RESPONSES = {
  addressSuggestions: {
    suggestions: THERESES_44A_DATA.suggestions
  },
  buildingLookup: THERESES_44A_DATA.buildingData,
  solarData: THERESES_44A_DATA.solarData
};