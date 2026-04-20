/**
 * Aggregerings-test for EiendomsgruppeService:
 * - Oppsal Borettslag (org.nr 948544474): 598 andeler, frisk Matrikkel-data
 * - Myrer Borettslag (org.nr 948152436): 408 andeler, ufullstendig Matrikkel
 *   (etasjedata=0 — krever CSV-fallback)
 * - Hesteskoen sameie (gnr 73/bnr 739): 196 seksjoner, flere bygg (rekkehus)
 *
 * Sanity-sjekk: m²/boenhet skal være 40–120 for boligblokker.
 *
 * Kjøres med:
 *   API_ENV=prod LIVE=1 npx tsx scripts/test-eiendomsgruppe-aggregering.ts
 */
import {
  aggregateForBorettslag,
  aggregateForSameie,
  type EiendomsgruppeResult,
} from "../services/grunnbok-service/EiendomsgruppeService.ts";

const MIN_M2_PER_BOENHET = 40;
const MAX_M2_PER_BOENHET = 120;

let antallFeil = 0;

function printResult(label: string, result: EiendomsgruppeResult) {
  console.log(`\n=== ${label} ===`);
  console.log(`Type:              ${result.type}`);
  if (result.organisasjonsnummer) console.log(`Orgnr:             ${result.organisasjonsnummer}`);
  if (result.matrikkelenhetRot) {
    const m = result.matrikkelenhetRot;
    console.log(`Matrikkel:         ${m.kommunenummer}-${m.gaardsnummer}-${m.bruksnummer}`);
  }
  console.log(`Antall enheter:    ${result.antallEnheter}`);
  console.log(`Unike bygg:        ${result.antallUnikeBygg}`);
  console.log(`Totalt bruksareal: ${result.totalBruksarealM2.toLocaleString("nb-NO")} m²`);

  const kildefordeling: Record<string, number> = {};
  for (const b of result.bygninger) {
    kildefordeling[b.bruksarealKilde] =
      (kildefordeling[b.bruksarealKilde] ?? 0) + 1;
  }
  console.log(`BRA-kildefordeling:`, kildefordeling);
  console.log(`Byggeår-fordeling: `, result.byggeaarFordeling);
  console.log(`TEK-fordeling:     `, result.tekFordeling);

  if (result.bygninger.length > 0) {
    const sample = result.bygninger.slice(0, 3);
    console.log(`Sample bygninger:`);
    for (const b of sample) {
      console.log(
        `  byggId=${b.byggId} byggeår=${b.byggeaar ?? "?"} BRA=${b.bruksarealM2 ?? "?"} (${b.bruksarealKilde}) TEK=${b.tekStandard} enheter=${b.antallEnheterIBygg}`
      );
    }
  }
  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings.slice(0, 5)) console.log(`  - ${w}`);
    if (result.warnings.length > 5) console.log(`  ... og ${result.warnings.length - 5} til`);
  }

  if (result.antallEnheter > 0 && result.totalBruksarealM2 > 0) {
    const m2PerEnhet = result.totalBruksarealM2 / result.antallEnheter;
    const ok =
      m2PerEnhet >= MIN_M2_PER_BOENHET && m2PerEnhet <= MAX_M2_PER_BOENHET;
    const status = ok ? "OK " : "FEIL";
    console.log(
      `Sanity:            ${m2PerEnhet.toFixed(1)} m²/boenhet  [${status} — forventet ${MIN_M2_PER_BOENHET}–${MAX_M2_PER_BOENHET}]`
    );
    if (!ok) antallFeil++;
  } else {
    console.log(
      `Sanity:            kan ikke beregnes (enheter=${result.antallEnheter}, BRA=${result.totalBruksarealM2})`
    );
    antallFeil++;
  }
}

async function kjoer<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  const result = await fn();
  const sek = ((Date.now() - start) / 1000).toFixed(1);
  printResult(`${label} (tok ${sek}s)`, result as unknown as EiendomsgruppeResult);
  return result;
}

async function main() {
  await kjoer("Oppsal Borettslag", () => aggregateForBorettslag("948544474"));
  await kjoer("Myrer Borettslag", () => aggregateForBorettslag("948152436"));
  await kjoer("Hesteskoen sameie", () => aggregateForSameie("0301", 73, 739));

  if (antallFeil > 0) {
    console.log(
      `\n✗ ${antallFeil} eiendomsgruppe(r) utenfor sanity-grenser`
    );
    process.exit(1);
  }
  console.log("\n✓ Ferdig — alle sanity-sjekker bestått");
}

main().catch((err) => {
  console.error("\n✗ Feilet:", err);
  process.exit(1);
});
