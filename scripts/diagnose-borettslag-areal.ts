/**
 * Diagnose-skript: hvor blir boarealet av for et borettslag?
 *
 * Kjører hele aggregeringspipelinen for en org.nr, og dumper per unike bygg:
 *   - byggId, byggeaar, bygningstypeKodeId
 *   - vårt valgte bruksarealM2 (fra StoreClient.extractBruksareal)
 *   - rå Matrikkel-felter: etasjedata/bruksarealTotalt, bebygdAreal,
 *     alternativtArealBygning, ufullstendigAreal, bruksarealM2 (top-level)
 *   - sum per etasje (bruksarealTilBolig, bruksarealTilAnnet, bruksarealTotalt)
 *
 * Målet er å se hvilke bygg som enten (a) mangler BRA helt, (b) faller tilbake
 * til fotavtrykk (bebygdAreal), eller (c) har sentinel-verdier (9999/99999),
 * slik at vi kan velge riktig fallback-kilde.
 *
 * Kjøres med:
 *   API_ENV=prod LIVE=1 npx tsx scripts/diagnose-borettslag-areal.ts <orgnr>
 *
 * Eksempel:
 *   API_ENV=prod LIVE=1 npx tsx scripts/diagnose-borettslag-areal.ts 948544474
 */
import { aggregateForBorettslag } from "../services/grunnbok-service/EiendomsgruppeService.ts";
import { StoreClient } from "../src/clients/StoreClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";
import { getRuntimeConfig } from "../packages/config/src/runtime.ts";
import { csvService } from "../src/services/csvService.ts";

interface RawByggFields {
  byggId: number;
  valgtBruksarealM2: number | null;
  etasjedataBruksarealTotalt: number | null;
  etasjedataBruksarealTilBolig: number | null;
  etasjedataBruksarealTilAnnet: number | null;
  sumEtasjerBruksarealTotalt: number | null;
  bebygdAreal: number | null;
  alternativtArealBygning: number | null;
  bruksarealM2TopLevel: number | null;
  ufullstendigAreal: boolean;
  antallEtasjer: number | null;
  bygningsnummer: string | null;
  csvBruksarealTotalt: number | null;
  csvBygningstypeNavn: string | null;
  csvAdresse: string | null;
  antallEnheterIBygg: number;
}

function extractFirst(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<(?:ns\\d+:)?${tag}(?:\\s[^>]*)?>\\s*<(?:ns\\d+:)?value>([^<]+)</`,
    ""
  );
  const m = xml.match(re);
  if (m) return m[1].trim();
  const direct = xml.match(
    new RegExp(`<(?:ns\\d+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:ns\\d+:)?${tag}>`)
  );
  return direct ? direct[1].trim() : null;
}

function toNumOrNull(s: string | null): number | null {
  if (s == null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extractEtasjedataField(xml: string, feltnavn: string): number | null {
  const etasjedataMatch = xml.match(
    /<(?:ns\d+:)?etasjedata[^>]*>([\s\S]*?)<\/(?:ns\d+:)?etasjedata>/
  );
  if (!etasjedataMatch) return null;
  return toNumOrNull(extractFirst(etasjedataMatch[1], feltnavn));
}

function extractAllEtasjer(xml: string): Array<{
  bruksarealTotalt: number | null;
  bruksarealTilBolig: number | null;
  bruksarealTilAnnet: number | null;
}> {
  const etasjerBlock = xml.match(
    /<(?:ns\d+:)?etasjer[^>]*>([\s\S]*?)<\/(?:ns\d+:)?etasjer>/
  );
  if (!etasjerBlock) return [];
  const items = [
    ...etasjerBlock[1].matchAll(
      /<(?:ns\d+:)?item[^>]*>([\s\S]*?)<\/(?:ns\d+:)?item>/g
    ),
  ];
  return items.map((m) => ({
    bruksarealTotalt: toNumOrNull(extractFirst(m[1], "bruksarealTotalt")),
    bruksarealTilBolig: toNumOrNull(extractFirst(m[1], "bruksarealTilBolig")),
    bruksarealTilAnnet: toNumOrNull(extractFirst(m[1], "bruksarealTilAnnet")),
  }));
}

function extractKommunalField(xml: string, feltnavn: string): number | null {
  const block = xml.match(
    /<(?:ns\d+:)?kommunalTilleggsdel[^>]*>([\s\S]*?)<\/(?:ns\d+:)?kommunalTilleggsdel>/
  );
  if (!block) return null;
  return toNumOrNull(extractFirst(block[1], feltnavn));
}

async function diagnoseBygg(
  storeClient: StoreClient,
  byggId: number,
  valgtBruksarealM2: number | null,
  antallEnheterIBygg: number
): Promise<RawByggFields> {
  const xml = await storeClient.getObjectXml(byggId, "ByggId");

  const etasjer = extractAllEtasjer(xml);
  const sumEtasjer =
    etasjer.length > 0
      ? etasjer.reduce((s, e) => s + (e.bruksarealTotalt ?? 0), 0)
      : null;

  const bygningsnummer = extractFirst(xml, "bygningsnummer");
  const csvMatch = bygningsnummer
    ? csvService.findByBygningsNr(bygningsnummer)
    : null;

  return {
    byggId,
    valgtBruksarealM2,
    etasjedataBruksarealTotalt: extractEtasjedataField(xml, "bruksarealTotalt"),
    etasjedataBruksarealTilBolig: extractEtasjedataField(
      xml,
      "bruksarealTilBolig"
    ),
    etasjedataBruksarealTilAnnet: extractEtasjedataField(
      xml,
      "bruksarealTilAnnet"
    ),
    sumEtasjerBruksarealTotalt: sumEtasjer,
    bebygdAreal: toNumOrNull(extractFirst(xml, "bebygdAreal")),
    alternativtArealBygning: extractKommunalField(xml, "alternativtArealBygning"),
    bruksarealM2TopLevel: toNumOrNull(extractFirst(xml, "bruksarealM2")),
    ufullstendigAreal: /<(?:ns\d+:)?ufullstendigAreal[^>]*>true</.test(xml),
    antallEtasjer: etasjer.length || null,
    bygningsnummer,
    csvBruksarealTotalt: csvMatch?.bruksarealTotalt ?? null,
    csvBygningstypeNavn: csvMatch?.bygningstypeNavn ?? null,
    csvAdresse: csvMatch?.gateAdresse ?? null,
    antallEnheterIBygg,
  };
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—".padStart(8);
  return String(Math.round(n)).padStart(8);
}

async function main() {
  const orgnr = process.argv[2];
  if (!orgnr) {
    console.error("Bruk: npx tsx scripts/diagnose-borettslag-areal.ts <orgnr>");
    process.exit(1);
  }

  console.log(`\n=== Diagnose: borettslag ${orgnr} ===\n`);

  const t0 = Date.now();
  const result = await aggregateForBorettslag(orgnr);
  const aggregeringsMs = Date.now() - t0;

  console.log(`Aggregering: ${(aggregeringsMs / 1000).toFixed(1)}s`);
  console.log(`Antall enheter:   ${result.antallEnheter}`);
  console.log(`Unike bygg:       ${result.antallUnikeBygg}`);
  console.log(
    `Totalt BRA (vårt): ${result.totalBruksarealM2.toLocaleString("nb-NO")} m²`
  );
  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const w of result.warnings) console.log(`  - ${w}`);
  }

  const runtimeConfig = getRuntimeConfig();
  const mc = runtimeConfig.flags.liveMode
    ? runtimeConfig.matrikkel.prod
    : runtimeConfig.matrikkel.current;
  const storeClient = new StoreClient(
    matrikkelEndpoint(mc.baseUrl, "StoreService"),
    mc.username,
    mc.password
  );

  console.log(
    `\nPer unike bygg (parallellitet=8, kan ta et par minutter for store borettslag):`
  );

  const diagnoser: RawByggFields[] = [];
  const concurrency = 8;
  for (let i = 0; i < result.bygninger.length; i += concurrency) {
    const batch = result.bygninger.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((b) =>
        diagnoseBygg(
          storeClient,
          b.byggId,
          b.bruksarealM2,
          b.antallEnheterIBygg
        ).catch((err) => {
          console.error(
            `  byggId=${b.byggId} diagnose feilet: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          return null;
        })
      )
    );
    for (const r of batchResults) if (r) diagnoser.push(r);
  }

  console.log(
    `\n${"byggId".padStart(10)} | ${"bygnr".padStart(
      9
    )} | ${"enh".padStart(4)} | ${"valgt".padStart(8)} | ${"altArea".padStart(
      8
    )} | ${"CSV BRA".padStart(8)} | CSV-match`
  );
  console.log("-".repeat(110));

  let sumValgt = 0;
  let sumEtasjedata = 0;
  let sumSumEtasjer = 0;
  let sumBebygd = 0;
  let sumAltArea = 0;
  let sumCsv = 0;
  let antallMedEtasjedata = 0;
  let antallMedBebygd = 0;
  let antallMedCsv = 0;
  let antallUfullstendig = 0;
  let antallSentinel = 0;
  let antallHeltTommme = 0;
  let antallLikBebygd = 0;
  const csvBygningstyper = new Map<string, number>();

  for (const d of diagnoser) {
    const csvLabel = d.csvBruksarealTotalt
      ? `${d.csvBygningstypeNavn ?? ""} — ${d.csvAdresse ?? ""}`
      : d.bygningsnummer
      ? "ingen CSV-treff"
      : "mangler bygningsnummer";
    console.log(
      `${String(d.byggId).padStart(10)} | ${(d.bygningsnummer ?? "—").padStart(
        9
      )} | ${String(d.antallEnheterIBygg).padStart(4)} | ${fmt(
        d.valgtBruksarealM2
      )} | ${fmt(d.alternativtArealBygning)} | ${fmt(
        d.csvBruksarealTotalt
      )} | ${csvLabel}`
    );

    if (d.valgtBruksarealM2) sumValgt += d.valgtBruksarealM2;
    if (d.etasjedataBruksarealTotalt) {
      sumEtasjedata += d.etasjedataBruksarealTotalt;
      antallMedEtasjedata++;
    }
    if (d.sumEtasjerBruksarealTotalt) sumSumEtasjer += d.sumEtasjerBruksarealTotalt;
    if (d.bebygdAreal) {
      sumBebygd += d.bebygdAreal;
      antallMedBebygd++;
    }
    if (d.alternativtArealBygning) sumAltArea += d.alternativtArealBygning;
    if (d.ufullstendigAreal) antallUfullstendig++;
    if (
      d.valgtBruksarealM2 === 9999 ||
      d.valgtBruksarealM2 === 99999 ||
      d.etasjedataBruksarealTotalt === 9999 ||
      d.etasjedataBruksarealTotalt === 99999
    ) {
      antallSentinel++;
    }
    if (
      !d.valgtBruksarealM2 &&
      !d.etasjedataBruksarealTotalt &&
      !d.sumEtasjerBruksarealTotalt
    ) {
      antallHeltTommme++;
    }
    if (
      d.valgtBruksarealM2 != null &&
      d.bebygdAreal != null &&
      Math.abs(d.valgtBruksarealM2 - d.bebygdAreal) < 2
    ) {
      antallLikBebygd++;
    }
    if (d.csvBruksarealTotalt) {
      sumCsv += d.csvBruksarealTotalt;
      antallMedCsv++;
      const type = d.csvBygningstypeNavn ?? "ukjent";
      csvBygningstyper.set(type, (csvBygningstyper.get(type) ?? 0) + 1);
    }
  }

  console.log("-".repeat(110));
  console.log(`\nSummer:`);
  console.log(
    `  sum(valgt BRA)              = ${sumValgt.toLocaleString(
      "nb-NO"
    )} m²  (${diagnoser.length} bygg)`
  );
  console.log(
    `  sum(etasjedata/brTotalt)    = ${sumEtasjedata.toLocaleString(
      "nb-NO"
    )} m²  (${antallMedEtasjedata} bygg har feltet)`
  );
  console.log(
    `  sum(Σ per etasje brTotalt)  = ${sumSumEtasjer.toLocaleString("nb-NO")} m²`
  );
  console.log(
    `  sum(bebygdAreal)            = ${sumBebygd.toLocaleString(
      "nb-NO"
    )} m²  (${antallMedBebygd} bygg har feltet)`
  );
  console.log(
    `  sum(alternativtArealBygning)= ${sumAltArea.toLocaleString("nb-NO")} m²`
  );
  console.log(
    `  sum(CSV bruksarealTotalt)   = ${sumCsv.toLocaleString(
      "nb-NO"
    )} m²  (${antallMedCsv}/${diagnoser.length} bygg har CSV-treff)`
  );
  if (csvBygningstyper.size > 0) {
    console.log(
      `  CSV bygningstype-fordeling:`,
      Object.fromEntries(csvBygningstyper)
    );
  }

  const totalEnheter = diagnoser.reduce((s, d) => s + d.antallEnheterIBygg, 0);
  console.log(
    `\nBruksenhet-sanity: ${totalEnheter} bruksenheter summert pr. bygg (vs. ${result.antallEnheter} andeler)`
  );
  console.log(`\nKvalitetsflagg:`);
  console.log(`  ufullstendigAreal=true:   ${antallUfullstendig} bygg`);
  console.log(`  sentinel (9999/99999):    ${antallSentinel} bygg`);
  console.log(`  helt tom areal-info:      ${antallHeltTommme} bygg`);
  console.log(
    `  valgt BRA = bebygdAreal:  ${antallLikBebygd} bygg (sannsynlig fotavtrykk-fallback)`
  );

  if (result.antallEnheter > 0) {
    console.log(
      `\nSanity m²/boenhet (forventet ~50–90):`
    );
    console.log(
      `  Vårt valgte BRA:  ${(sumValgt / result.antallEnheter).toFixed(1)} m²`
    );
    if (sumCsv > 0) {
      console.log(
        `  CSV BRA:          ${(sumCsv / result.antallEnheter).toFixed(1)} m²`
      );
    }
  }

  console.log("\n✓ Ferdig");
}

main().catch((err) => {
  console.error("\n✗ Feilet:", err);
  process.exit(1);
});
