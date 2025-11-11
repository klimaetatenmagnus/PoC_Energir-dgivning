#!/usr/bin/env tsx

import 'dotenv/config';
import { resolveBuildingData } from '../services/building-info-service/index.ts';

interface Summary {
  adresse: string;
  matrikkelenhetsId: number;
  byggId: number;
  byggeaar: number | null;
  bruksarealM2: number | null;
  totalBygningsareal: number | null;
  lat: number | null;
  lon: number | null;
}

function summarize(address: string, data: Awaited<ReturnType<typeof resolveBuildingData>>): Summary {
  return {
    adresse: address,
    matrikkelenhetsId: data.matrikkelenhetsId,
    byggId: data.byggId,
    byggeaar: data.byggeaar,
    bruksarealM2: data.bruksarealM2,
    totalBygningsareal: data.totalBygningsareal,
    lat: data.coordinatesWgs84?.lat ?? null,
    lon: data.coordinatesWgs84?.lon ?? null,
  };
}

async function main() {
  const addresses = ['Hesteskoen 4A, Oslo', 'Hesteskoen 4L, Oslo', 'Hesteskoen 4M, Oslo'];
  const results: Summary[] = [];

  const debug = !!process.env.DEBUG_BUILDING_INFO;

  for (const adresse of addresses) {
    console.log(`\n🔎 Fetching data for ${adresse}`);
    const data = await resolveBuildingData(adresse, { debug });
    results.push(summarize(adresse, data));
  }

  console.log('\n📊 Result summary:');
  console.table(
    results.map((r) => ({
      Adresse: r.adresse,
      Matrikkelenhet: r.matrikkelenhetsId,
      Bygg: r.byggId,
      Byggeår: r.byggeaar ?? '-',
      'Bruksareal (m²)': r.bruksarealM2 ?? '-',
      'Total areal (m²)': r.totalBygningsareal ?? '-',
      'Lat/Lon': r.lat && r.lon ? `${r.lat.toFixed(5)}, ${r.lon.toFixed(5)}` : '-',
    }))
  );

  const baseline = results[0];
  const mismatches: string[] = [];

  for (const comparison of results.slice(1)) {
    if (comparison.matrikkelenhetsId !== baseline.matrikkelenhetsId) {
      mismatches.push(`${comparison.adresse}: matrikkelenhets-ID ${comparison.matrikkelenhetsId} vs ${baseline.matrikkelenhetsId}`);
    }
    if (comparison.byggId !== baseline.byggId) {
      mismatches.push(`${comparison.adresse}: bygg-ID ${comparison.byggId} vs ${baseline.byggId}`);
    }
    if (comparison.bruksarealM2 !== baseline.bruksarealM2) {
      mismatches.push(`${comparison.adresse}: bruksareal ${comparison.bruksarealM2} vs ${baseline.bruksarealM2}`);
    }
    if (comparison.lat !== baseline.lat || comparison.lon !== baseline.lon) {
      mismatches.push(`${comparison.adresse}: koordinater avviker`);
    }
  }

  if (mismatches.length) {
    console.error('\n❌ Avvik funnet mellom seksjoner:');
    mismatches.forEach((m) => console.error(`  - ${m}`));
    process.exitCode = 1;
  } else {
    console.log('\n✅ Alle seksjoner matcher baseline');
  }
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
