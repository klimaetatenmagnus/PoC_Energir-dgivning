/**
 * Testscript for validering av soldata-oppslag mot PBE Solkart
 *
 * Tester ulike oppslag-metoder for å finne den mest pålitelige måten
 * å hente korrekt soldata for en adresse.
 *
 * Kjør med: npx tsx scripts/test-soldata-validation.ts
 */

import fetch from 'node-fetch';

const SOLAR_SERVICE_URL = 'http://localhost:4003/solinnstraling';
const GEONORGE_URL = 'https://ws.geonorge.no/adresser/v1/sok';

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

// Testadresser med forventede verdier fra PBE Solkart
const TEST_ADDRESSES: TestAddress[] = [
  {
    address: 'Fallanveien 29, 0495 Oslo',
    expected: {
      takflateIds: [16344, 17202],
      totalArea: 380,
      filteredSolarEnergy: 35932, // Kun takflate 17202 > 800 kWh/m²/år
      bygningsnummer: '80190816',
    },
    geonorge: {
      lat: 59.96215723,
      lon: 10.79299229,
    },
    csvBygningsNr: '80190816',
    apiBygningsNr: '80190719', // Feil bygningsnummer fra API
  },
];

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

async function fetchSolarData(params: Record<string, string | number>): Promise<SolarResponse | null> {
  const url = new URL(SOLAR_SERVICE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      if (response.status === 404) {
        return { error: 'Ingen takflater funnet' };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json() as SolarResponse;
  } catch (error) {
    console.error(`  ❌ Feil ved oppslag: ${error}`);
    return null;
  }
}

async function lookupGeonorge(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${GEONORGE_URL}?sok=${encodeURIComponent(address)}&fuzzy=true`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Energitiltak/1.0' },
    });
    if (!response.ok) return null;

    const data = await response.json() as { adresser?: Array<{ representasjonspunkt?: { lat: number; lon: number } }> };
    if (!data.adresser?.length) return null;

    const punkt = data.adresser[0].representasjonspunkt;
    if (!punkt) return null;

    return { lat: punkt.lat, lon: punkt.lon };
  } catch (error) {
    console.error(`  ❌ Geonorge-oppslag feilet: ${error}`);
    return null;
  }
}

function calculateFilteredEnergy(takflater: SolarResponse['takflater'], minRadiation = 800, efficiency = 0.2): number {
  if (!takflater?.length) return 0;
  return takflater
    .filter(tak => tak.irr_kwh_m2_yr > minRadiation)
    .reduce((sum, tak) => sum + tak.area_m2 * tak.irr_kwh_m2_yr * efficiency, 0);
}

function formatResult(result: SolarResponse | null, expected: TestAddress['expected']): void {
  if (!result) {
    console.log('    Resultat: null');
    return;
  }

  if (result.error) {
    console.log(`    Feil: ${result.error}`);
    return;
  }

  const takflater = result.takflater || [];
  const takIds = takflater.map(t => t.tak_id).sort((a, b) => a - b);
  const totalArea = takflater.reduce((sum, t) => sum + t.area_m2, 0);
  const filteredEnergy = calculateFilteredEnergy(takflater);

  const idsMatch = JSON.stringify(takIds) === JSON.stringify(expected.takflateIds.sort((a, b) => a - b));
  const areaMatch = Math.abs(totalArea - expected.totalArea) < 1;
  const energyMatch = Math.abs(filteredEnergy - expected.filteredSolarEnergy) < 100;

  console.log(`    Takflate-IDer: ${takIds.join(', ')} ${idsMatch ? '✅' : '❌'} (forventet: ${expected.takflateIds.join(', ')})`);
  console.log(`    Totalt areal: ${totalArea.toFixed(1)} m² ${areaMatch ? '✅' : '❌'} (forventet: ${expected.totalArea} m²)`);
  console.log(`    Filtrert solenergi: ${Math.round(filteredEnergy)} kWh ${energyMatch ? '✅' : '❌'} (forventet: ${expected.filteredSolarEnergy} kWh)`);

  if (takflater.length > 0) {
    console.log('    Takflater:');
    takflater.forEach(tak => {
      console.log(`      - ID ${tak.tak_id}: ${tak.area_m2.toFixed(1)} m², ${tak.irr_kwh_m2_yr.toFixed(0)} kWh/m²/år, bygg_nr=${tak.bygg_nr || 'null'}`);
    });
  }

  return;
}

async function runTests(): Promise<void> {
  console.log('='.repeat(80));
  console.log('SOLDATA VALIDERING MOT PBE SOLKART');
  console.log('='.repeat(80));
  console.log();

  for (const testAddr of TEST_ADDRESSES) {
    console.log(`\n📍 ${testAddr.address}`);
    console.log('-'.repeat(60));

    // Test 1: Oppslag med riktig bygningsnummer (fra CSV)
    if (testAddr.csvBygningsNr) {
      console.log('\n  1️⃣  Oppslag med RIKTIG bygningsnummer (csvData.bygningsNr):');
      console.log(`      bygg_nr=${testAddr.csvBygningsNr}`);
      const result = await fetchSolarData({ bygg_nr: testAddr.csvBygningsNr });
      formatResult(result, testAddr.expected);
    }

    // Test 2: Oppslag med feil bygningsnummer (fra API)
    if (testAddr.apiBygningsNr && testAddr.apiBygningsNr !== testAddr.csvBygningsNr) {
      console.log('\n  2️⃣  Oppslag med FEIL bygningsnummer (API bygningsnummer):');
      console.log(`      bygg_nr=${testAddr.apiBygningsNr}`);
      const result = await fetchSolarData({ bygg_nr: testAddr.apiBygningsNr });
      formatResult(result, testAddr.expected);
    }

    // Test 3: Oppslag med Geonorge-koordinater
    console.log('\n  3️⃣  Oppslag med Geonorge-koordinater:');
    let geoCoords = testAddr.geonorge;
    if (!geoCoords) {
      console.log('      Henter koordinater fra Geonorge...');
      geoCoords = await lookupGeonorge(testAddr.address);
    }
    if (geoCoords) {
      console.log(`      lat=${geoCoords.lat}, lon=${geoCoords.lon}`);
      const result = await fetchSolarData({ lat: geoCoords.lat, lon: geoCoords.lon });
      formatResult(result, testAddr.expected);
    } else {
      console.log('      ❌ Kunne ikke hente koordinater fra Geonorge');
    }

    // Test 4: Oppslag med API-koordinater (hvis forskjellig fra Geonorge)
    // TODO: Legg til når vi har API-koordinater

    console.log();
  }

  console.log('='.repeat(80));
  console.log('KONKLUSJON');
  console.log('='.repeat(80));
  console.log(`
  Hvis test 1 (csvData.bygningsNr) gir riktige resultater og test 2 (API bygningsnummer)
  gir feil resultater, bekrefter dette at problemet ligger i valg av bygningsnummer
  i resolveBuildingData.

  ANBEFALT FIX:
  1. Bruk csvData.bygningsNr for soloppslag i stedet for bygg.bygningsnummer
  2. Eller: Bruk Geonorge-koordinater direkte for soloppslag
  `);
}

// Kjør tester
runTests().catch(console.error);
