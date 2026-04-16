/**
 * Aggregerings-test for EiendomsgruppeService:
 * - Oppsal Borettslag (org.nr 948544474): forventet 598 andeler, ukjent antall bygg
 * - Hesteskoen sameie (gnr 73/bnr 739): 196 seksjoner, forventet flere bygg (rekkehus)
 *
 * Kjøres med:
 *   API_ENV=prod LIVE=1 npx tsx scripts/test-eiendomsgruppe-aggregering.ts
 */
import {
  aggregateForBorettslag,
  aggregateForSameie,
} from "../services/grunnbok-service/EiendomsgruppeService.ts";

function printResult(label: string, result: Awaited<ReturnType<typeof aggregateForBorettslag>>) {
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
  console.log(`Byggeår-fordeling:`, result.byggeaarFordeling);
  console.log(`TEK-fordeling:    `, result.tekFordeling);
  if (result.bygninger.length > 0) {
    const sample = result.bygninger.slice(0, 3);
    console.log(`Sample bygninger:`);
    for (const b of sample) {
      console.log(
        `  byggId=${b.byggId} byggeår=${b.byggeaar ?? "?"} BRA=${b.bruksarealM2 ?? "?"} TEK=${b.tekStandard} enheter=${b.antallEnheterIBygg}`
      );
    }
  }
  if (result.warnings.length > 0) {
    console.log(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings.slice(0, 5)) console.log(`  - ${w}`);
    if (result.warnings.length > 5) console.log(`  ... og ${result.warnings.length - 5} til`);
  }
}

async function main() {
  const startOppsal = Date.now();
  const oppsal = await aggregateForBorettslag("948544474");
  printResult(
    `Oppsal Borettslag (tok ${((Date.now() - startOppsal) / 1000).toFixed(1)}s)`,
    oppsal
  );

  const startHesteskoen = Date.now();
  const hesteskoen = await aggregateForSameie("0301", 73, 739);
  printResult(
    `Hesteskoen sameie (tok ${((Date.now() - startHesteskoen) / 1000).toFixed(1)}s)`,
    hesteskoen
  );

  console.log("\n✓ Ferdig");
}

main().catch((err) => {
  console.error("\n✗ Feilet:", err);
  process.exit(1);
});
