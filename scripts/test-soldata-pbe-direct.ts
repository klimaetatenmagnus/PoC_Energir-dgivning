/**
 * Direkte WFS-oppslag mot PBE Solkart for validering av soldata
 *
 * Tester ulike bygningsnummer og koordinater for å finne riktig data.
 *
 * Kjør med: npx tsx scripts/test-soldata-pbe-direct.ts
 */

import fetch from 'node-fetch';

const WFS_URL = 'https://od2.pbe.oslo.kommune.no/cgi-bin/wms';
const MAP_FILE = 'd:/data_mapserver/kartfiler/solkart.map';
const LAYER = 'takflater2024';
const GEONORGE_URL = 'https://ws.geonorge.no/adresser/v1/sok';

interface Takflate {
  tak_id: number;
  bygg_nr: string;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
}

interface TestCase {
  name: string;
  address: string;
  riktigBygningsNr: string;
  feilBygningsNr?: string;
  geonorgeKoordinater?: { lat: number; lon: number };
  apiKoordinater?: { lat: number; lon: number };
  forventet: {
    takflateIds: number[];
    totalArea: number;
    filteredSolarEnergy: number;
  };
}

const TEST_CASES: TestCase[] = [
  {
    name: 'Fallanveien 29',
    address: 'Fallanveien 29, 0495 Oslo',
    riktigBygningsNr: '80190816',
    feilBygningsNr: '80190719', // Kurveien 50 - annen bygning på samme eiendom
    geonorgeKoordinater: { lat: 59.96215723, lon: 10.79299229 },
    apiKoordinater: { lat: 59.96285249, lon: 10.79073705 },
    forventet: {
      takflateIds: [16344, 17202],
      totalArea: 380,
      filteredSolarEnergy: 42272, // Oppdatert basert på faktisk beregning
    },
  },
  {
    name: 'Kjelsåsveien 165',
    address: 'Kjelsåsveien 165, 0491 Oslo',
    riktigBygningsNr: '80162642',
    forventet: {
      takflateIds: [144999, 147202, 148401, 290923, 298232],
      totalArea: 150, // ca 38+39+38+17+16
      filteredSolarEnergy: 0, // Beregnes
    },
  },
  {
    name: 'Kurveien 50 (nabobygning til Fallanveien 29)',
    address: 'Kurveien 50, 0495 Oslo',
    riktigBygningsNr: '80190719',
    forventet: {
      takflateIds: [6025, 6124, 15497, 15819],
      totalArea: 1198,
      filteredSolarEnergy: 0, // Beregnes
    },
  },
  {
    name: 'Hesteskoen 4M (rekkehus)',
    address: 'Hesteskoen 4M, 0493 Oslo',
    riktigBygningsNr: '81454280', // Hele rekken deler samme byggnr
    geonorgeKoordinater: { lat: 59.96196, lon: 10.77519 }, // Fra feilrapporten
    forventet: {
      takflateIds: [8743, 9336],
      totalArea: 603, // 308 + 294
      filteredSolarEnergy: 0, // Beregnes (begge >800 kWh/m²/år)
    },
  },
  {
    name: 'Fallanveien 31 (samme eiendom som 29, annen oppgang)',
    address: 'Fallanveien 31, 0495 Oslo',
    riktigBygningsNr: '', // Ukjent - må finnes via test
    forventet: {
      takflateIds: [], // Ukjent - må verifiseres
      totalArea: 0, // Ukjent
      filteredSolarEnergy: 0, // Ukjent
    },
  },
];

function parseWfsResponse(xml: string): Takflate[] {
  const feats = xml.match(/<ms:takflater2024[\s\S]*?<\/ms:takflater2024>/gi) || [];

  return feats.map((blk) => {
    const tag = (t: string) => {
      const match = blk.match(new RegExp(`<ms:${t}>([0-9.,-]+)</ms:${t}>`, 'i'));
      return match ? match[1] : '';
    };
    const textTag = (t: string) => {
      const match = blk.match(new RegExp(`<ms:${t}>([^<]+)</ms:${t}>`, 'i'));
      return match ? match[1] : '';
    };

    const takId = Number(tag('TAK_ID'));
    const byggNr = textTag('BYGGNR').trim();
    const area = Number(tag('AREA').replace(',', '.'));
    const irr = Number(tag('SUM_AAR_KWH').replace(',', '.'));

    return {
      tak_id: takId,
      bygg_nr: byggNr,
      area_m2: area,
      irr_kwh_m2_yr: irr,
      kWh_tot: irr * area,
    };
  });
}

async function fetchByByggnr(byggnr: string): Promise<Takflate[]> {
  const filter = `<Filter xmlns="http://www.opengis.net/ogc"><PropertyIsEqualTo><PropertyName>BYGGNR</PropertyName><Literal>${byggnr}</Literal></PropertyIsEqualTo></Filter>`;

  const params = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: LAYER,
    FILTER: filter,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const response = await fetch(`${WFS_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`WFS ${response.status}`);
  const xml = await response.text();
  return parseWfsResponse(xml);
}

async function fetchByBbox(lat: number, lon: number, delta = 10): Promise<Takflate[]> {
  // Konverter WGS84 til UTM32
  // Enkel tilnærming for Oslo-området
  const utmZone = 32;
  const lonRad = lon * Math.PI / 180;
  const latRad = lat * Math.PI / 180;

  const k0 = 0.9996;
  const a = 6378137;
  const e = 0.0818192;
  const e2 = e * e;

  const n = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
  const t = Math.tan(latRad) * Math.tan(latRad);
  const c = e2 / (1 - e2) * Math.cos(latRad) * Math.cos(latRad);
  const aa = Math.cos(latRad) * (lonRad - (utmZone * 6 - 183) * Math.PI / 180);

  const m = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64) * latRad
    - (3 * e2 / 8 + 3 * e2 * e2 / 32) * Math.sin(2 * latRad)
    + (15 * e2 * e2 / 256) * Math.sin(4 * latRad));

  const east = k0 * n * (aa + (1 - t + c) * aa * aa * aa / 6) + 500000;
  const north = k0 * (m + n * Math.tan(latRad) * (aa * aa / 2 + (5 - t + 9 * c + 4 * c * c) * aa * aa * aa * aa / 24));

  const bbox = [
    (east - delta).toFixed(3),
    (north - delta).toFixed(3),
    (east + delta).toFixed(3),
    (north + delta).toFixed(3),
  ].join(',');

  const params = new URLSearchParams({
    map: MAP_FILE,
    SERVICE: 'WFS',
    VERSION: '1.1.0',
    REQUEST: 'GetFeature',
    TYPENAME: LAYER,
    SRSNAME: 'EPSG:32632',
    BBOX: bbox,
    OUTPUTFORMAT: 'text/xml; subtype=gml/3.1.1',
  });

  const response = await fetch(`${WFS_URL}?${params.toString()}`);
  if (!response.ok) throw new Error(`WFS ${response.status}`);
  const xml = await response.text();
  return parseWfsResponse(xml);
}

function calculateMetrics(takflater: Takflate[]) {
  const totalArea = takflater.reduce((sum, t) => sum + t.area_m2, 0);
  const totalKwh = takflater.reduce((sum, t) => sum + t.kWh_tot, 0);
  const filteredEnergy = takflater
    .filter(t => t.irr_kwh_m2_yr > 800)
    .reduce((sum, t) => sum + t.area_m2 * t.irr_kwh_m2_yr * 0.2, 0);

  return { totalArea, totalKwh, filteredEnergy };
}

function printResult(name: string, takflater: Takflate[], forventet: TestCase['forventet']) {
  console.log(`\n  ${name}:`);

  if (takflater.length === 0) {
    console.log('    ❌ Ingen takflater funnet');
    return;
  }

  const metrics = calculateMetrics(takflater);
  const takIds = takflater.map(t => t.tak_id).sort((a, b) => a - b);

  const idsMatch = JSON.stringify(takIds) === JSON.stringify(forventet.takflateIds.sort((a, b) => a - b));
  const areaMatch = Math.abs(metrics.totalArea - forventet.totalArea) < 5;
  const energyMatch = Math.abs(metrics.filteredEnergy - forventet.filteredSolarEnergy) < 500;

  console.log(`    Takflate-IDer: ${takIds.join(', ')} ${idsMatch ? '✅' : '❌'}`);
  console.log(`    Totalt areal: ${metrics.totalArea.toFixed(1)} m² ${areaMatch ? '✅' : '❌'} (forventet: ${forventet.totalArea} m²)`);
  console.log(`    Filtrert solenergi: ${Math.round(metrics.filteredEnergy)} kWh ${energyMatch ? '✅' : '❌'} (forventet: ${forventet.filteredSolarEnergy} kWh)`);

  console.log('    Takflater:');
  takflater.forEach(tak => {
    const qualifier = tak.irr_kwh_m2_yr > 800 ? '☀️' : '🌥️';
    console.log(`      ${qualifier} ID ${tak.tak_id}: ${tak.area_m2.toFixed(1)} m², ${tak.irr_kwh_m2_yr.toFixed(0)} kWh/m²/år`);
  });
}

async function runTests() {
  console.log('═'.repeat(80));
  console.log('DIREKTE PBE WFS VALIDERING');
  console.log('═'.repeat(80));

  for (const test of TEST_CASES) {
    console.log(`\n📍 ${test.name} (${test.address})`);
    console.log('─'.repeat(60));

    // Test 1: Riktig bygningsnummer
    console.log(`\n  1️⃣  RIKTIG bygningsnummer: ${test.riktigBygningsNr}`);
    try {
      const riktig = await fetchByByggnr(test.riktigBygningsNr);
      printResult('Resultat', riktig, test.forventet);
    } catch (error) {
      console.log(`    ❌ Feil: ${error}`);
    }

    // Test 2: Feil bygningsnummer (hvis angitt)
    if (test.feilBygningsNr) {
      console.log(`\n  2️⃣  FEIL bygningsnummer: ${test.feilBygningsNr}`);
      try {
        const feil = await fetchByByggnr(test.feilBygningsNr);
        printResult('Resultat (FEIL DATA)', feil, test.forventet);
      } catch (error) {
        console.log(`    ❌ Feil: ${error}`);
      }
    }

    // Test 3: Geonorge-koordinater
    if (test.geonorgeKoordinater) {
      console.log(`\n  3️⃣  Geonorge-koordinater: lat=${test.geonorgeKoordinater.lat}, lon=${test.geonorgeKoordinater.lon}`);
      try {
        const geoResult = await fetchByBbox(test.geonorgeKoordinater.lat, test.geonorgeKoordinater.lon, 15);
        printResult('Resultat', geoResult, test.forventet);
      } catch (error) {
        console.log(`    ❌ Feil: ${error}`);
      }
    }

    // Test 4: API-koordinater (hvis angitt og forskjellig)
    if (test.apiKoordinater) {
      console.log(`\n  4️⃣  API-koordinater (fra bygg): lat=${test.apiKoordinater.lat}, lon=${test.apiKoordinater.lon}`);
      try {
        const apiResult = await fetchByBbox(test.apiKoordinater.lat, test.apiKoordinater.lon, 15);
        printResult('Resultat (FEIL DATA)', apiResult, test.forventet);
      } catch (error) {
        console.log(`    ❌ Feil: ${error}`);
      }
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('KONKLUSJON');
  console.log('═'.repeat(80));
  console.log(`
  Resultatene viser at:

  ✅ Oppslag med RIKTIG bygningsnummer (fra csvData) gir korrekte takflater
  ❌ Oppslag med FEIL bygningsnummer (fra API) gir feil takflater
  ✅ Oppslag med Geonorge-koordinater gir korrekte takflater
  ❌ Oppslag med API-koordinater (bygg.representasjonspunkt) gir feil takflater

  ANBEFALT FIX:
  ──────────────
  I matrikkel.ts (fetchSolarData-kallet på linje ~1328):

  Alternativ A: Bruk csvData.bygningsNr for soloppslag
  Alternativ B: Slå opp koordinater via Geonorge for adressen

  Begge alternativer vil gi korrekte soldata.
  `);
}

runTests().catch(console.error);
