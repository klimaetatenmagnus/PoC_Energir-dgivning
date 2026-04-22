/**
 * Sammenlikner filteredSolarEnergy beregnet fra:
 *   (A) Dagens formel via live PBE (unfiltered area, faktor 0.2, irr > 800)
 *   (B) Ny formel (irr > 800 OG area ≥ 20, faktor 0.8 × 0.2) på Excel/CSV-data
 *   (C) Ny formel på live PBE-takflater (applied client-side)
 *
 * (B) og (C) skal matche nær perfekt — beviser at CSV-en er en tro kopi av
 * PBE-datagrunnlaget. (A) vs (B) viser hvor mye UI-tallene endrer seg når vi
 * bytter formel.
 *
 * Kjør:
 *   API_ENV=prod LIVE=1 SOLAR_SERVICE_BASE_URL=http://localhost:4003 \
 *     npx tsx scripts/compare-solar-csv-vs-pbe.ts
 */
import proj4 from 'proj4';
import { StoreClient } from '../src/clients/StoreClient.ts';
import { MatrikkelClient } from '../src/clients/MatrikkelClient.ts';
import { MatrikkelBruksenhetHelper } from '../services/grunnbok-service/MatrikkelBruksenhetHelper.ts';
import {
  getSolarCsvService,
  SOLAR_FILTER_DEFAULTS,
} from '../src/services/solarCsvService.ts';

interface LookupCase {
  label: string;
  gnr: number;
  bnr: number;
}

const CASES: LookupCase[] = [
  { label: 'Selvbyggerveien 175 (enkeltbolig i sameiet)', gnr: 85, bnr: 119 },
  { label: 'Haakon Tveters vei 44 (Oppsal Borettslag)', gnr: 146, bnr: 238 },
  { label: 'Fallanveien 29 (Myrer Borettslag)', gnr: 88, bnr: 262 },
  { label: 'Grefsenkollveien 7B', gnr: 75, bnr: 1226 },
  { label: 'Thereses gate 11A', gnr: 216, bnr: 221 },
  { label: 'Lyseveien 3', gnr: 29, bnr: 130 },
];

const baseUrl = process.env.MATRIKKEL_API_BASE_URL_PROD!.replace(/\/$/, '');
const username = process.env.MATRIKKEL_USERNAME!;
const password = process.env.MATRIKKEL_PASSWORD!;
const solarBase = (process.env.SOLAR_SERVICE_BASE_URL ?? 'http://localhost:4003').replace(
  /\/$/,
  '',
);

const matrikkel = new MatrikkelClient(
  `${baseUrl}/MatrikkelenhetServiceWS`,
  username,
  password,
);
const store = new StoreClient(`${baseUrl}/StoreServiceWS`, username, password);
const helper = new MatrikkelBruksenhetHelper(baseUrl, username, password);
const ctx = {
  locale: 'no_NO_B',
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: 'trunk',
  klientIdentifikasjon: 'compare-solar',
  snapshotVersion: { timestamp: '9999-01-01T00:00:00+01:00' },
} as const;

interface PbeTakflate {
  tak_id?: number;
  area_m2?: number;
  irr_kwh_m2_yr?: number;
}
interface PbeResponse {
  takflater?: PbeTakflate[];
  filteredSolarEnergy?: number;
  sol_kwh_bygg_tot?: number;
  takAreal_m2?: number;
}

async function fetchPbeByLatLon(lat: number, lon: number): Promise<PbeResponse | null> {
  try {
    const r = await fetch(
      `${solarBase}/solinnstraling?lat=${lat}&lon=${lon}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!r.ok) return null;
    return (await r.json()) as PbeResponse;
  } catch {
    return null;
  }
}

function applyNewFormulaToTakflater(takflater: PbeTakflate[]): number {
  const { minRadiation, minArea, areaCoverage, panelEfficiency } = SOLAR_FILTER_DEFAULTS;
  let total = 0;
  for (const t of takflater) {
    const area = Number(t.area_m2) || 0;
    const irr = Number(t.irr_kwh_m2_yr) || 0;
    if (irr > minRadiation && area >= minArea) {
      total += area * irr * areaCoverage * panelEfficiency;
    }
  }
  return total;
}

async function listByggForCase(c: LookupCase): Promise<number[]> {
  const matIds = await matrikkel.findMatrikkelenheter(
    { kommunenummer: '0301', gnr: c.gnr, bnr: c.bnr },
    ctx,
  );
  const bruksenheter = new Set<number>();
  for (const meId of matIds) {
    const brIds = await helper.findBruksenhetIdsForMatrikkelenhet(meId);
    for (const id of brIds) bruksenheter.add(id);
  }
  const { byggIdCount } = await helper.mapBruksenhetIdsToByggIds(
    Array.from(bruksenheter),
    10,
  );
  return Array.from(byggIdCount.keys());
}

const fmt = (n: number) => n.toFixed(0).padStart(8);
const pct = (a: number, b: number) =>
  b === 0 ? (a === 0 ? '   0.0%' : '   n/a ') : `${(((a - b) / b) * 100).toFixed(1)}%`.padStart(7);

async function main() {
  const svc = getSolarCsvService();
  await svc.waitForReady();
  console.log(`Solar CSV: ${svc.size} bygg lastet\n`);

  const tableHeader =
    'BYGG (bygningsnr)           │ PBE-gml │ CSV-ny  │ PBE-ny  │ CSV vs PBE-ny │ ny vs gml';
  console.log(tableHeader);
  console.log('─'.repeat(tableHeader.length));

  let groupA = 0, groupB = 0, groupC = 0;
  let diverging: string[] = [];

  for (const c of CASES) {
    console.log(`\n## ${c.label} (gnr ${c.gnr}/bnr ${c.bnr})`);
    const byggIds = await listByggForCase(c);

    let caseA = 0, caseB = 0, caseC = 0;
    for (const byggId of byggIds) {
      const info = await store.getObject(byggId);
      const bnr = (info as { bygningsnummer?: string }).bygningsnummer;
      const rp = (info as { representasjonspunkt?: { east: number; north: number } })
        .representasjonspunkt;
      if (!rp || !bnr) continue;
      const bnrInt = Number(bnr);

      const wgs = proj4('EPSG:32632', 'EPSG:4326', [rp.east, rp.north]);
      const pbe = await fetchPbeByLatLon(wgs[1], wgs[0]);
      const pbeTakflater = pbe?.takflater ?? [];
      const aOld = Number(pbe?.filteredSolarEnergy) || 0;
      const cNew = applyNewFormulaToTakflater(pbeTakflater);

      const csv = svc.getForBygningsnummer(bnrInt);
      const bNew = csv?.filteredSolarEnergy ?? 0;

      const csvVsPbe = pct(bNew, cNew);
      const newVsOld = pct(bNew, aOld);

      caseA += aOld;
      caseB += bNew;
      caseC += cNew;

      const divergensAbs = Math.abs(bNew - cNew);
      const divergensRel = cNew > 0 ? divergensAbs / cNew : bNew > 0 ? 1 : 0;
      const flag = divergensRel > 0.005 ? ' ⚠' : '';
      const csvN = csv?.antallTakflaterTotalt ?? 0;
      const pbeN = pbeTakflater.length;
      const takInfo = csvN === pbeN ? `(${csvN}tak)` : `(CSV:${csvN}/PBE:${pbeN})`;

      console.log(
        `  bygg ${String(byggId).padStart(10)} (bnr ${String(bnrInt).padStart(9)}) ${takInfo.padEnd(14)} │ ${fmt(
          aOld,
        )} │ ${fmt(bNew)} │ ${fmt(cNew)} │ ${csvVsPbe}       │ ${newVsOld}${flag}`,
      );
      if (divergensRel > 0.005) {
        diverging.push(
          `${c.label} byggnr ${bnrInt}: CSV=${bNew.toFixed(0)} (${csvN} tak), PBE-ny=${cNew.toFixed(0)} (${pbeN} tak)`,
        );
      }
    }
    console.log(
      `  SUM ${String(byggIds.length).padStart(28)} bygg │ ${fmt(caseA)} │ ${fmt(caseB)} │ ${fmt(
        caseC,
      )} │ ${pct(caseB, caseC)}       │ ${pct(caseB, caseA)}`,
    );
    groupA += caseA;
    groupB += caseB;
    groupC += caseC;
  }

  console.log('\n═══ TOTALT ═══');
  console.log(`  PBE gammel formel : ${groupA.toFixed(0).padStart(10)} kWh`);
  console.log(`  CSV ny formel     : ${groupB.toFixed(0).padStart(10)} kWh  (${pct(groupB, groupA)} vs gammel)`);
  console.log(`  PBE ny formel     : ${groupC.toFixed(0).padStart(10)} kWh  (${pct(groupB, groupC)} CSV vs PBE-ny)`);

  if (diverging.length > 0) {
    console.log(`\n⚠ ${diverging.length} bygg med CSV/PBE-avvik > 0.5%:`);
    for (const d of diverging) console.log(`  - ${d}`);
    process.exit(2);
  }
  console.log('\n✓ CSV matcher PBE-data innenfor 0.5% toleranse for alle bygg');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
