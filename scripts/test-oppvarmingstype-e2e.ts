// scripts/test-oppvarmingstype-e2e.ts
// ─────────────────────────────────────────────────────────────────────────────
// E2E-test: Henter oppvarmingstype og energikilde fra Matrikkelen for 100
// tilfeldige boligadresser i Oslo (fra Matrikkel 2023.csv).
//
// Inkluderer:
//  - Stratifisert tilfeldig utvalg fra hele Oslo (alle bydeler + byggtyper)
//  - Multi-variant adresseoppslag (samme logikk som matrikkel.ts)
//  - Representativitetsanalyse (byområder og byggtyper)
//  - Sammenligning med kjent fjernvarmestatistikk for Oslo
//
// Kjør:  LIVE=1 npx tsx scripts/test-oppvarmingstype-e2e.ts
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import "../loadEnv.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { BygningClient } from "../src/clients/BygningClient.ts";
import { StoreClient, type ByggInfo } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

/* ─────────────────────────── Config ──────────────────────────── */

const BASE_URL =
  process.env.MATRIKKEL_API_BASE_URL_PROD ||
  "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;
const IS_LIVE = process.env.LIVE === "1";

const SAMPLE_SIZE = 100;
const DELAY_MS = 200;

const MATRIKKEL_CSV = path.resolve(
  import.meta.dirname ?? ".",
  "../data/raw/Matrikkel 2023.csv"
);

const ENOVA_CSV = path.resolve(
  import.meta.dirname ?? ".",
  "../data/raw/enova-energimerker-oslo.csv"
);

const CSV_OUTPUT = path.resolve(
  import.meta.dirname ?? ".",
  "../workspace-archive/oppvarmingstype-resultater.csv"
);

/* ──────────── Matrikkel oppvarming/energikilde kodeverk ──────── */
// Korrekt kodeverk hentet fra KodelisteServiceWS.getKodelisterEnkel()
// Intern ID er 0-indeksert. Kodeverdi er den offisielle bokstavkoden.

const OPPVARMING_KODER: Record<number, string> = {
  0: "Elektrisk",          // kodeverdi E
  1: "Sentralvarme",       // kodeverdi S
  2: "Annen oppvarming",   // kodeverdi A
};

const ENERGIKILDE_KODER: Record<number, string> = {
  0: "Elektrisitet",                 // kodeverdi E
  1: "Olje/parafin/fl.brensel",      // kodeverdi O
  2: "Biobrensel",                   // kodeverdi B
  3: "Solenergi",                    // kodeverdi S
  4: "Varmepumpe",                   // kodeverdi V
  5: "Gass",                         // kodeverdi G
  6: "Fjernvarme",                   // kodeverdi F
  7: "Annen energikilde",            // kodeverdi A
};

// Fjernvarme-kode-ID for direkte matching
const FJERNVARME_KODE_ID = 6;

/* ─── Kjent fjernvarmestatistikk for Oslo (referanseverdier) ──── */

// Kilde: SSB tabell 10906 + Hafslund Oslo Celsio årsrapporter
const OSLO_FJERNVARME_REF = {
  boligblokkerProsent: 25,       // ~25% av boligblokker i Oslo
  smaahusProsent: 2,             // ~2% av småhus (enebolig/tomanns/rekke)
  totalBoligProsent: 15,         // ~15% av alle boliger samlet
  kilde: "SSB tabell 10906 / Hafslund Oslo Celsio",
};

/* ─────────────────────── Matrikkelkontekst ───────────────────── */

function ctx() {
  return {
    locale: "no_NO_B",
    brukOriginaleKoordinater: true,
    koordinatsystemKodeId: 25833,
    systemVersion: "trunk",
    klientIdentifikasjon: "oppvarming-e2e",
    snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
  } as const;
}

/* ───────── Stratifisert sampling fra Matrikkel 2023 ─────────── */

interface MatrikkelRow {
  bygningsNr: string;
  bygningstype: string;
  bygningstypeNavn: string;
  bydel: string;
  gateAdresse: string;
}

function readMatrikkelCsv(): MatrikkelRow[] {
  const raw = fs.readFileSync(MATRIKKEL_CSV, "utf-8");
  const lines = raw.trim().split("\n").slice(1);
  const rows: MatrikkelRow[] = [];

  for (const line of lines) {
    const cols = line.split(";");
    const bygningstype = cols[9] ?? "";
    const gateAdresse = cols[22] ?? "";

    // Bare boliger (type 11-15) med gateadresse
    if (!bygningstype.match(/^1[1-5]/) || !gateAdresse) continue;

    rows.push({
      bygningsNr: cols[0] ?? "",
      bygningstype,
      bygningstypeNavn: cols[10] ?? "",
      bydel: cols[16] ?? "",
      gateAdresse,
    });
  }

  return rows;
}

function stratifiedSample(rows: MatrikkelRow[], n: number): MatrikkelRow[] {
  // Grupper etter bydel + byggtype-kategori
  const buckets = new Map<string, MatrikkelRow[]>();
  for (const row of rows) {
    const typeKat = row.bygningstype.slice(0, 2); // "11", "12", "13", "14", "15"
    const key = `${row.bydel}|${typeKat}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(row);
  }

  // Shuffle hver bucket
  for (const arr of buckets.values()) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Round-robin fra buckets til vi har n
  const result: MatrikkelRow[] = [];
  const keys = [...buckets.keys()].sort();
  let idx = 0;
  while (result.length < n) {
    const key = keys[idx % keys.length];
    const bucket = buckets.get(key)!;
    if (bucket.length > 0) {
      result.push(bucket.pop()!);
    } else {
      // Tom bucket – fjern den
      keys.splice(idx % keys.length, 1);
      if (keys.length === 0) break;
      continue;
    }
    idx++;
  }

  return result;
}

/* ──────────── Enova energiattest-indeks (bygningsnr) ─────────── */

interface EnovaRow {
  bygningsnummer: string;
  gateAdresse: string;
  energikarakter: string;
  oppvarmingskarakter: string;  // Red, Orange, Yellow, Green, Lightgreen
  byggeaar: string;
  bygningskategori: string;
  fossilandel: string;
}

/**
 * Oppvarmingskarakter-fargene:
 *   Grønn/Lysgrønn = lav andel el+fossilt → typisk fjernvarme, bio, varmepumpe
 *   Gul            = middels
 *   Oransje/Rød    = høy andel el+fossilt → typisk direkte-el eller oljefyr
 *
 * Grønn/Lysgrønn er sterkeste indikator på fjernvarme blant Enova-data.
 */
const OPPV_KARAKTER_LABEL: Record<string, string> = {
  Lightgreen: "Lysgrønn (fornybar/fjernvarme)",
  Green: "Grønn (hovedsakelig fornybar)",
  Yellow: "Gul (blandet)",
  Orange: "Oransje (el/fossilt)",
  Red: "Rød (el/fossilt-dominert)",
};

function buildEnovaIndex(): Map<string, EnovaRow> {
  if (!fs.existsSync(ENOVA_CSV)) {
    console.warn(`  ⚠  Enova-CSV ikke funnet: ${ENOVA_CSV}`);
    return new Map();
  }

  const raw = fs.readFileSync(ENOVA_CSV, "utf-8");
  const lines = raw.trim().split("\n");
  const header = lines[0].split(",");

  // Finn kolonne-indekser
  const idx = (name: string) => header.findIndex((h) => h.trim().replace(/^\uFEFF/, "") === name);
  const iBygNr = idx("Bygningsnummer");
  const iAdr = idx("GateAdresse");
  const iEKar = idx("Energikarakter");
  const iOKar = idx("Oppvarmingskarakter");
  const iBaar = idx("Byggear");
  const iKat = idx("Bygningskategori");
  const iFoss = idx("BeregnetFossilandel");

  const index = new Map<string, EnovaRow>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const bygNr = cols[iBygNr]?.trim();
    if (!bygNr) continue;

    index.set(bygNr, {
      bygningsnummer: bygNr,
      gateAdresse: cols[iAdr]?.trim() ?? "",
      energikarakter: cols[iEKar]?.trim() ?? "",
      oppvarmingskarakter: cols[iOKar]?.trim() ?? "",
      byggeaar: cols[iBaar]?.trim() ?? "",
      bygningskategori: cols[iKat]?.trim() ?? "",
      fossilandel: cols[iFoss]?.trim() ?? "",
    });
  }

  return index;
}

/* ────────────── Geonorge-oppslag med multi-variant ──────────── */

interface GeoResult {
  kommunenummer: string;
  gnr: number;
  bnr: number;
  adressekode?: number;
  husnummer?: number;
  bokstav?: string;
  adressetekst?: string;
}

type GeoResp = {
  adresser?: {
    kommunenummer: string;
    gardsnummer: number;
    bruksnummer: number;
    adressekode?: number;
    nummer?: string;
    husnummer?: number;
    bokstav?: string;
    adressetekst?: string;
  }[];
};

function buildGeoUrl(query: string): string {
  return (
    "https://ws.geonorge.no/adresser/v1/sok?" +
    new URLSearchParams({ sok: query, fuzzy: "true" })
      .toString()
      .replace(/\+/g, "%20")
  );
}

function parseGeoResponse(json: GeoResp): GeoResult {
  if (!json.adresser?.length) throw new Error("Adresse ikke funnet i Geonorge");
  const a = json.adresser[0];
  return {
    kommunenummer: a.kommunenummer,
    gnr: a.gardsnummer,
    bnr: a.bruksnummer,
    adressekode: a.adressekode,
    husnummer: Number(a.nummer ?? a.husnummer ?? 0),
    bokstav: a.bokstav ?? "",
    adressetekst: a.adressetekst ?? "",
  };
}

async function lookupAdresse(adresse: string): Promise<GeoResult> {
  const headers = { "User-Agent": "Energitiltak/1.0" };

  // Multi-variant logikk (samme som matrikkel.ts)
  const variants = [
    adresse,
    adresse.replace(/,/g, " ").trim().replace(/\s+/g, " "),
    adresse
      .replace(/,/g, " ")
      .replace(/(\d+)([A-Za-z])/, "$1 $2")
      .trim()
      .replace(/\s+/g, " "),
    adresse
      .replace(/,/g, " ")
      .replace(/(\d+)\s+([A-Za-z])/, "$1$2")
      .trim()
      .replace(/\s+/g, " "),
    adresse.replace(/(\d+)\s+([A-Za-z])/, "$1$2"),
    adresse.replace(/\./g, "").trim().replace(/\s+/g, " "),
    adresse.replace(/[.,]/g, " ").trim().replace(/\s+/g, " "),
  ];

  for (const variant of variants) {
    const resp = await fetch(buildGeoUrl(variant), { headers });
    if (!resp.ok) continue;
    try {
      return parseGeoResponse((await resp.json()) as GeoResp);
    } catch {
      continue;
    }
  }

  throw new Error("Ingen adresse funnet i Geonorge etter alle varianter");
}

/* ─────────────────────── Resultat-type ───────────────────────── */

interface AdresseResult {
  address: string;
  bygningsNr: string;
  buildingType: string;
  bydel: string;
  status: "ok" | "error";
  error?: string;
  gnr?: number;
  bnr?: number;
  byggId?: number;
  oppvarmingsKodeIds: number[];
  energikildeKodeIds: number[];
  // Enova-data (fra bulk-CSV)
  enovaMatch: boolean;
  enovaEnergikarakter?: string;
  enovaOppvarmingskarakter?: string;
  enovaFossilandel?: string;
}

/* ──────────── Representativitetsanalyse ──────────────────────── */

function analyserRepresentativitet(
  sample: MatrikkelRow[],
  allRows: MatrikkelRow[],
  results: AdresseResult[]
) {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  REPRESENTATIVITETSANALYSE");
  console.log("══════════════════════════════════════════════════");

  // 1) Byggtype-fordeling: utvalg vs. populasjon
  const sampleTypes = tally(sample.map((r) => r.bygningstype));
  const popTypes = tally(allRows.map((r) => r.bygningstype));

  console.log("\n  Byggtype-fordeling (utvalg vs. populasjon):");
  console.log("  %-38s  %8s  %8s", "Type", "Utvalg", "Pop.");
  for (const [type] of [...popTypes.entries()].sort((a, b) => b[1] - a[1])) {
    const sN = sampleTypes.get(type) ?? 0;
    const pN = popTypes.get(type) ?? 0;
    const sPct = ((sN / sample.length) * 100).toFixed(0);
    const pPct = ((pN / allRows.length) * 100).toFixed(0);
    console.log(`    ${type.padEnd(38)} ${String(sN).padStart(4)} (${sPct}%)   ${String(pN).padStart(6)} (${pPct}%)`);
  }

  // 2) Bydels-fordeling
  const sampleBydel = tally(sample.map((r) => r.bydel));
  const popBydel = tally(allRows.map((r) => r.bydel));

  console.log("\n  Bydels-fordeling (utvalg vs. populasjon):");
  for (const [bydel] of [...popBydel.entries()].sort((a, b) => b[1] - a[1])) {
    const sN = sampleBydel.get(bydel) ?? 0;
    const pN = popBydel.get(bydel) ?? 0;
    const sPct = ((sN / sample.length) * 100).toFixed(0);
    const pPct = ((pN / allRows.length) * 100).toFixed(0);
    console.log(`    ${bydel.padEnd(24)} ${String(sN).padStart(3)} (${sPct}%)   ${String(pN).padStart(6)} (${pPct}%)`);
  }

  // 3) Unike GNR
  const gnrSet = new Set(results.filter((r) => r.gnr).map((r) => r.gnr));
  console.log(`\n  Unike GNR-verdier: ${gnrSet.size}`);
  console.log(`  Unike bydeler i utvalget: ${sampleBydel.size} av ${popBydel.size}`);

  // 4) Vurdering
  const antallSmahus = [...sampleTypes.entries()]
    .filter(([t]) => t.startsWith("11") || t.startsWith("12") || t.startsWith("13"))
    .reduce((s, [, n]) => s + n, 0);
  const antallBlokker = [...sampleTypes.entries()]
    .filter(([t]) => t.startsWith("14") || t.startsWith("15"))
    .reduce((s, [, n]) => s + n, 0);

  console.log("\n  Kategori-sammendrag:");
  console.log(`    Småhus (11-13): ${antallSmahus} (${pct(antallSmahus, sample.length)})`);
  console.log(`    Blokker (14-15): ${antallBlokker} (${pct(antallBlokker, sample.length)})`);

  if (sampleBydel.size >= popBydel.size * 0.8) {
    console.log("    OK: Utvalget dekker de fleste bydeler.");
  } else {
    console.log(`    ⚠  Utvalget dekker bare ${sampleBydel.size}/${popBydel.size} bydeler.`);
  }
}

/* ──────────── Enova-kryssreferanse ────────────────────────── */

function analyserEnovaKryssreferanse(results: AdresseResult[]) {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  ENOVA ENERGIATTEST-KRYSSREFERANSE");
  console.log("══════════════════════════════════════════════════");

  const allWithEnova = results.filter((r) => r.enovaMatch);
  const total = results.length;

  console.log(`\n  Treff i Enova-data: ${allWithEnova.length}/${total} (${pct(allWithEnova.length, total)})`);

  if (allWithEnova.length === 0) {
    console.log("  Ingen treff – kan ikke analysere.");
    return;
  }

  // Oppvarmingskarakter-fordeling
  const oppvKarFordeling = tally(allWithEnova.map((r) => r.enovaOppvarmingskarakter ?? "Ukjent"));

  console.log("\n  Oppvarmingskarakter-fordeling (Enova):");
  for (const [karakter, antall] of [...oppvKarFordeling.entries()].sort((a, b) => b[1] - a[1])) {
    const label = OPPV_KARAKTER_LABEL[karakter] ?? karakter;
    console.log(`    ${label}: ${antall} (${pct(antall, allWithEnova.length)})`);
  }

  // Energikarakter-fordeling
  const eKarFordeling = tally(allWithEnova.map((r) => r.enovaEnergikarakter ?? "Ukjent"));

  console.log("\n  Energikarakter-fordeling (Enova):");
  for (const [karakter, antall] of [...eKarFordeling.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${karakter}: ${antall} (${pct(antall, allWithEnova.length)})`);
  }

  // Fjernvarme-proxy: Grønn/Lysgrønn oppvarmingskarakter indikerer fornybar oppvarming
  // (fjernvarme, varmepumpe, bio). Ikke 100% fjernvarme, men beste proxy i Enova-data.
  const fornybar = allWithEnova.filter(
    (r) => r.enovaOppvarmingskarakter === "Green" || r.enovaOppvarmingskarakter === "Lightgreen"
  );

  // Nedbryt per bygningstype
  const fornybarSmahus = fornybar.filter((r) => {
    const k = r.buildingType.slice(0, 2);
    return k === "11" || k === "12" || k === "13";
  });
  const fornybarBlokker = fornybar.filter((r) => {
    const k = r.buildingType.slice(0, 2);
    return k === "14" || k === "15";
  });

  const enovaSmahus = allWithEnova.filter((r) => {
    const k = r.buildingType.slice(0, 2);
    return k === "11" || k === "12" || k === "13";
  });
  const enovaBlokker = allWithEnova.filter((r) => {
    const k = r.buildingType.slice(0, 2);
    return k === "14" || k === "15";
  });

  console.log("\n  Grønn/lysgrønn oppvarmingskarakter (proxy for fornybar/fjernvarme):");
  console.log(`    Totalt:   ${fornybar.length}/${allWithEnova.length} (${pct(fornybar.length, allWithEnova.length)})`);
  console.log(`    Småhus:   ${fornybarSmahus.length}/${enovaSmahus.length} (${pct(fornybarSmahus.length, enovaSmahus.length)})`);
  console.log(`    Blokker:  ${fornybarBlokker.length}/${enovaBlokker.length} (${pct(fornybarBlokker.length, enovaBlokker.length)})`);

  // Kryss-sjekk: bygninger med Matrikkel-data OG Enova
  const begge = allWithEnova.filter((r) => r.oppvarmingsKodeIds.length > 0 || r.energikildeKodeIds.length > 0);
  console.log(`\n  Bygninger med data i BEGGE kilder: ${begge.length}`);
  if (begge.length > 0) {
    for (const r of begge) {
      const matrOppv = r.oppvarmingsKodeIds.map((k) => OPPVARMING_KODER[k] ?? `?${k}`).join(", ");
      const matrEnki = r.energikildeKodeIds.map((k) => ENERGIKILDE_KODER[k] ?? `?${k}`).join(", ");
      console.log(`    ${r.address} (${r.bydel}):`);
      console.log(`      Matrikkel: oppv=[${matrOppv}] energi=[${matrEnki}]`);
      console.log(`      Enova:     ${r.enovaEnergikarakter}/${r.enovaOppvarmingskarakter} fossilandel=${r.enovaFossilandel}`);
    }
  }

  // Fossilandel-analyse (Enova)
  const fossilVerdier = allWithEnova
    .map((r) => parseFloat((r.enovaFossilandel ?? "").replace(",", ".")))
    .filter(Number.isFinite);

  if (fossilVerdier.length > 0) {
    const gjennomsnitt = fossilVerdier.reduce((a, b) => a + b, 0) / fossilVerdier.length;
    const lavFossil = fossilVerdier.filter((v) => v < 0.1).length;
    console.log(`\n  Fossilandel-analyse (Enova BeregnetFossilandel):`);
    console.log(`    Gjennomsnitt: ${(gjennomsnitt * 100).toFixed(1)}%`);
    console.log(`    Under 10% (trolig fornybar/fjernvarme): ${lavFossil}/${fossilVerdier.length}`);
  }
}

/* ───────── Sammenligning med fjernvarmestatistikk ───────────── */

function sammenlignMedFjernvarmestatistikk(results: AdresseResult[]) {
  console.log("\n══════════════════════════════════════════════════");
  console.log("  FJERNVARME-SAMMENLIGNING");
  console.log("══════════════════════════════════════════════════");

  const ok = results.filter((r) => r.status === "ok");
  const total = ok.length;
  if (total === 0) {
    console.log("  Ingen vellykkede oppslag.");
    return;
  }

  const smahus = ok.filter((r) => {
    const k = r.buildingType.slice(0, 2);
    return k === "11" || k === "12" || k === "13";
  });
  const blokker = ok.filter((r) => {
    const k = r.buildingType.slice(0, 2);
    return k === "14" || k === "15";
  });

  // Fjernvarme-indikatorer
  const medFjernvarmeEnergi = ok.filter((r) => r.energikildeKodeIds.includes(FJERNVARME_KODE_ID));
  const medSentralvarme = ok.filter((r) => r.oppvarmingsKodeIds.includes(1));  // kode 1 = Sentralvarme
  const medElektrisk = ok.filter((r) => r.oppvarmingsKodeIds.includes(0));    // kode 0 = Elektrisk

  const smahuseMedFjernvarme = smahus.filter((r) => r.energikildeKodeIds.includes(FJERNVARME_KODE_ID));
  const blokkerMedFjernvarme = blokker.filter((r) => r.energikildeKodeIds.includes(FJERNVARME_KODE_ID));

  const medOppvarmingsdata = ok.filter((r) => r.oppvarmingsKodeIds.length > 0);
  const medEnergikildedata = ok.filter((r) => r.energikildeKodeIds.length > 0);

  console.log("\n  Matrikkelen-data (våre oppslag):");
  console.log(`    Bygninger med oppvarmingsdata:    ${medOppvarmingsdata.length}/${total} (${pct(medOppvarmingsdata.length, total)})`);
  console.log(`    Bygninger med energikildedata:    ${medEnergikildedata.length}/${total} (${pct(medEnergikildedata.length, total)})`);
  console.log(`    Med sentralvarme (kode 1):        ${medSentralvarme.length}`);
  console.log(`    Med elektrisk (kode 2):           ${medElektrisk.length}`);
  console.log(`    Med fjernvarme energikilde (5):   ${medFjernvarmeEnergi.length}`);

  console.log("\n  Nedbrutt per bygningstype:");
  console.log(`    Småhus totalt:                    ${smahus.length}`);
  console.log(`      - med fjernvarme (energi=5):    ${smahuseMedFjernvarme.length} (${pct(smahuseMedFjernvarme.length, smahus.length)})`);
  console.log(`    Blokker totalt:                   ${blokker.length}`);
  console.log(`      - med fjernvarme (energi=5):    ${blokkerMedFjernvarme.length} (${pct(blokkerMedFjernvarme.length, blokker.length)})`);

  console.log("\n  Referanse: Fjernvarmetilknytning i Oslo (SSB / Celsio):");
  console.log(`    Småhus:     ~${OSLO_FJERNVARME_REF.smaahusProsent}%`);
  console.log(`    Blokker:    ~${OSLO_FJERNVARME_REF.boligblokkerProsent}%`);
  console.log(`    Totalt:     ~${OSLO_FJERNVARME_REF.totalBoligProsent}%`);
  console.log(`    Kilde:      ${OSLO_FJERNVARME_REF.kilde}`);

  // Forventet vs faktisk
  const forventetSmahus = Math.round(smahus.length * (OSLO_FJERNVARME_REF.smaahusProsent / 100));
  const forventetBlokker = Math.round(blokker.length * (OSLO_FJERNVARME_REF.boligblokkerProsent / 100));
  const forventetTotal = Math.round(total * (OSLO_FJERNVARME_REF.totalBoligProsent / 100));

  console.log("\n  Forventet vs. faktisk fjernvarme (energikilde=6):");
  console.log(`    Småhus:   forventet ~${forventetSmahus}, funnet ${smahuseMedFjernvarme.length}`);
  console.log(`    Blokker:  forventet ~${forventetBlokker}, funnet ${blokkerMedFjernvarme.length}`);
  console.log(`    Totalt:   forventet ~${forventetTotal}, funnet ${medFjernvarmeEnergi.length}`);

  // Analyse
  console.log("\n  Analyse:");
  const dataDekning = (medOppvarmingsdata.length / total) * 100;

  if (dataDekning < 20) {
    console.log(`    ⚠  Lav datadekning: kun ${pct(medOppvarmingsdata.length, total)} har oppvarmingsdata.`);
    console.log("       Matrikkelen har ufullstendig registrering for disse feltene.");
  } else {
    console.log(`    Datadekning: ${pct(medOppvarmingsdata.length, total)} har oppvarmingsdata.`);
  }

  if (medFjernvarmeEnergi.length === 0 && forventetTotal > 0) {
    console.log("    ⚠  Ingen bygninger har energikilde=6 (fjernvarme), men statistisk");
    console.log(`       forventet vi ~${forventetTotal}. Indikerer at Matrikkelen mangler`);
    console.log("       fjernvarmedata, eller at feltene sjelden fylles ut.");
  } else if (medFjernvarmeEnergi.length > 0) {
    const faktiskPct = (medFjernvarmeEnergi.length / total) * 100;
    const avvik = faktiskPct - OSLO_FJERNVARME_REF.totalBoligProsent;
    console.log(`    Faktisk fjernvarmeandel: ${pct(medFjernvarmeEnergi.length, total)}`);
    console.log(`    Referanse totalt:        ${OSLO_FJERNVARME_REF.totalBoligProsent}%`);
    console.log(`    Avvik:                   ${avvik > 0 ? "+" : ""}${avvik.toFixed(1)} prosentpoeng`);
  }

  // Konklusjon
  console.log("\n  KONKLUSJON:");
  if (dataDekning < 20) {
    console.log("    Matrikkelen har svært lav utfyllingsgrad for oppvarming/energikilde.");
    console.log("    Disse feltene er ikke egnet som primærkilde for oppvarmingstype.");
    console.log("    Vurder Enova-data eller energiattester som alternativ/supplement.");
  } else if (medFjernvarmeEnergi.length < forventetTotal * 0.5) {
    console.log("    Matrikkelen rapporterer vesentlig færre fjernvarmetilkoblinger enn");
    console.log("    forventet. Feltene er trolig underrapportert.");
  } else {
    console.log("    Matrikkelens data ser rimelig ut sammenlignet med kjent statistikk.");
  }
}

/* ─────────────────── Hjelpefunksjoner ────────────────────────── */

function tally<T>(items: T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const item of items) m.set(item, (m.get(item) ?? 0) + 1);
  return m;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return ((n / total) * 100).toFixed(1) + "%";
}

/* ─────────────────────────── Main ────────────────────────────── */

async function main() {
  if (!IS_LIVE) {
    console.error("Kjør med LIVE=1 for å gjøre faktiske API-kall.");
    process.exit(1);
  }

  if (!USERNAME || !PASSWORD) {
    console.error("Mangler MATRIKKEL_USERNAME / MATRIKKEL_PASSWORD i miljøet.");
    process.exit(1);
  }

  // 1) Les Matrikkel 2023 og trekk stratifisert utvalg
  console.log(`Leser boliger fra ${MATRIKKEL_CSV} ...`);
  const allRows = readMatrikkelCsv();
  console.log(`  ${allRows.length} boliger med gateadresse funnet.`);

  const sample = stratifiedSample(allRows, SAMPLE_SIZE);
  console.log(`  Trukket ${sample.length} stratifiserte adresser.`);

  // 2) Bygg Enova-indeks (bygningsnummer → energiattest)
  console.log(`\nLeser Enova-attester fra ${ENOVA_CSV} ...`);
  const enovaIndex = buildEnovaIndex();
  console.log(`  ${enovaIndex.size} bygninger i Enova-indeksen.\n`);

  // Opprett klienter
  const matrikkelClient = new MatrikkelClient(
    matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
    USERNAME,
    PASSWORD
  );
  const bygningClient = new BygningClient(
    matrikkelEndpoint(BASE_URL, "BygningService"),
    USERNAME,
    PASSWORD
  );
  const storeClient = new StoreClient(
    matrikkelEndpoint(BASE_URL, "StoreService"),
    USERNAME,
    PASSWORD
  );

  const results: AdresseResult[] = [];
  let okCount = 0;
  let errorCount = 0;
  const oppvarmingDistribution = new Map<number, number>();
  const energikildeDistribution = new Map<number, number>();
  const errorTypes = new Map<string, number>();

  for (let i = 0; i < sample.length; i++) {
    const row = sample[i];
    const label = `[${i + 1}/${sample.length}] ${row.gateAdresse} (${row.bydel}, ${row.bygningstype})`;
    process.stdout.write(`${label} ... `);

    try {
      // 1) Geonorge-oppslag (multi-variant)
      const geo = await lookupAdresse(row.gateAdresse + ", Oslo");

      // 2) Finn matrikkelenheter
      const matrikkelIds = await matrikkelClient.findMatrikkelenheter(
        {
          kommunenummer: geo.kommunenummer,
          gnr: geo.gnr,
          bnr: geo.bnr,
          adressekode: geo.adressekode,
          husnummer: geo.husnummer,
          bokstav: geo.bokstav,
        },
        ctx()
      );

      if (!matrikkelIds.length) throw new Error("Ingen matrikkelenheter funnet");

      // 3) Finn bygninger
      const byggIds = await bygningClient.findByggForMatrikkelenhet(
        matrikkelIds[0],
        ctx()
      );

      if (!byggIds.length) throw new Error("Ingen bygninger funnet");

      // 4) Hent bygningsdetaljer
      const bygg: ByggInfo = await storeClient.getObject(byggIds[0]);

      // Enova-oppslag via bygningsnummer
      const enova = enovaIndex.get(row.bygningsNr);

      results.push({
        address: row.gateAdresse,
        bygningsNr: row.bygningsNr,
        buildingType: row.bygningstype,
        bydel: row.bydel,
        status: "ok",
        gnr: geo.gnr,
        bnr: geo.bnr,
        byggId: byggIds[0],
        oppvarmingsKodeIds: bygg.oppvarmingsKodeIds,
        energikildeKodeIds: bygg.energikildeKodeIds,
        enovaMatch: !!enova,
        enovaEnergikarakter: enova?.energikarakter,
        enovaOppvarmingskarakter: enova?.oppvarmingskarakter,
        enovaFossilandel: enova?.fossilandel,
      });
      okCount++;

      for (const k of bygg.oppvarmingsKodeIds) {
        oppvarmingDistribution.set(k, (oppvarmingDistribution.get(k) ?? 0) + 1);
      }
      for (const k of bygg.energikildeKodeIds) {
        energikildeDistribution.set(k, (energikildeDistribution.get(k) ?? 0) + 1);
      }

      const oppStr = bygg.oppvarmingsKodeIds.length
        ? `matr:oppv=[${bygg.oppvarmingsKodeIds.map((k) => `${k}:${OPPVARMING_KODER[k] ?? "?"}`).join(", ")}]`
        : "matr:oppv=[]";
      const eneStr = bygg.energikildeKodeIds.length
        ? `matr:enki=[${bygg.energikildeKodeIds.map((k) => `${k}:${ENERGIKILDE_KODER[k] ?? "?"}`).join(", ")}]`
        : "matr:enki=[]";
      const enovaStr = enova
        ? `enova:${enova.energikarakter}/${enova.oppvarmingskarakter}`
        : "enova:-";

      console.log(`OK  ${oppStr}  ${eneStr}  ${enovaStr}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const enovaFallback = enovaIndex.get(row.bygningsNr);
      results.push({
        address: row.gateAdresse,
        bygningsNr: row.bygningsNr,
        buildingType: row.bygningstype,
        bydel: row.bydel,
        status: "error",
        error: msg,
        oppvarmingsKodeIds: [],
        energikildeKodeIds: [],
        enovaMatch: !!enovaFallback,
        enovaEnergikarakter: enovaFallback?.energikarakter,
        enovaOppvarmingskarakter: enovaFallback?.oppvarmingskarakter,
        enovaFossilandel: enovaFallback?.fossilandel,
      });
      errorCount++;
      const shortMsg = msg.slice(0, 60);
      errorTypes.set(shortMsg, (errorTypes.get(shortMsg) ?? 0) + 1);
      console.log(`FEIL: ${msg}`);
    }

    if (i < sample.length - 1) await delay(DELAY_MS);
  }

  // ────────────────── Skriv CSV ──────────────────

  const csvHeader =
    "Address,BygningsNr,BuildingType,Bydel,Status,Error,GNR,BNR,ByggId,OppvarmingsKodeIds,EnergikildeKodeIds,EnovaMatch,EnovaEnergikarakter,EnovaOppvarmingskarakter,EnovaFossilandel";
  const csvLines = results.map((r) =>
    [
      `"${r.address}"`,
      `"${r.bygningsNr}"`,
      `"${r.buildingType}"`,
      `"${r.bydel}"`,
      r.status,
      `"${(r.error ?? "").replace(/"/g, '""')}"`,
      r.gnr ?? "",
      r.bnr ?? "",
      r.byggId ?? "",
      `"${r.oppvarmingsKodeIds.join(",")}"`,
      `"${r.energikildeKodeIds.join(",")}"`,
      r.enovaMatch ? "ja" : "nei",
      r.enovaEnergikarakter ?? "",
      r.enovaOppvarmingskarakter ?? "",
      `"${r.enovaFossilandel ?? ""}"`,
    ].join(",")
  );

  fs.writeFileSync(CSV_OUTPUT, [csvHeader, ...csvLines].join("\n"), "utf-8");
  console.log(`\nResultater skrevet til ${CSV_OUTPUT}`);

  // ────────────────── Grunnleggende statistikk ──────────────────

  const withOppvarming = results.filter((r) => r.oppvarmingsKodeIds.length > 0).length;
  const withEnergikilde = results.filter((r) => r.energikildeKodeIds.length > 0).length;

  console.log("\n══════════════════════════════════════════════════");
  console.log("  GRUNNLEGGENDE STATISTIKK");
  console.log("══════════════════════════════════════════════════");
  console.log(`  Totalt adresser:            ${sample.length}`);
  console.log(`  Vellykket oppslag:          ${okCount}`);
  console.log(`  Feil:                       ${errorCount}`);
  console.log(`  Med oppvarmingsKodeIds:      ${withOppvarming} / ${okCount} (${pct(withOppvarming, okCount)})`);
  console.log(`  Med energikildeKodeIds:      ${withEnergikilde} / ${okCount} (${pct(withEnergikilde, okCount)})`);

  if (oppvarmingDistribution.size > 0) {
    console.log("\n  Fordeling oppvarmingsKodeIds:");
    for (const [kode, antall] of [...oppvarmingDistribution.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    Kode ${kode} (${OPPVARMING_KODER[kode] ?? "Ukjent"}): ${antall} bygninger`);
    }
  }

  if (energikildeDistribution.size > 0) {
    console.log("\n  Fordeling energikildeKodeIds:");
    for (const [kode, antall] of [...energikildeDistribution.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    Kode ${kode} (${ENERGIKILDE_KODER[kode] ?? "Ukjent"}): ${antall} bygninger`);
    }
  }

  if (errorTypes.size > 0) {
    console.log("\n  Feiltyper:");
    for (const [type, antall] of [...errorTypes.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${antall}`);
    }
  }

  // ────────────────── Analyser ──────────────────

  analyserRepresentativitet(sample, allRows, results);
  analyserEnovaKryssreferanse(results);
  sammenlignMedFjernvarmestatistikk(results);

  console.log("══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal feil:", err);
  process.exit(1);
});
