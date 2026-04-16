/**
 * Verifiser Grunnbok SOAP-klienten mot ekte data:
 * - Oppsal Borettslag (Haakon Tveters vei 44, 0301/146/238) → 598 andeler
 * - Hesteskoen sameie (gnr 73/bnr 739) → 196 seksjoner
 *
 * Kjøres med:
 *   API_ENV=prod npx tsx scripts/test-grunnbok-oppsal.ts
 */
import {
  identService,
  registerenhetService,
  registerenhetsrettService,
  registerenhetsrettsandelService,
  storeService,
  grunnbokEnabled,
} from "../services/grunnbok-service/context.ts";

async function assertAvailable() {
  if (
    !grunnbokEnabled() ||
    !identService ||
    !registerenhetService ||
    !registerenhetsrettService ||
    !registerenhetsrettsandelService ||
    !storeService
  ) {
    throw new Error(
      "Grunnbok-credentials mangler. Sett GRUNNBOK_USERNAME og GRUNNBOK_PASSWORD."
    );
  }
}

async function testOppsalBorettslag(): Promise<void> {
  console.log("\n=== OPPSAL BORETTSLAG (forventet 598 andeler) ===");

  // Steg 1: adresse → matrikkelenhetId
  const matrikkelId = await identService!.findMatrikkelenhetId({
    kommunenummer: "0301",
    gaardsnummer: 146,
    bruksnummer: 238,
  });
  console.log("matrikkelenhetId:", matrikkelId);
  if (!matrikkelId) throw new Error("Fant ikke matrikkelenhet");

  // Steg 2: matrikkelenhet → rett
  const retter = await registerenhetsrettService!.findRetterForEnheter(
    matrikkelId
  );
  console.log("rettIds:", retter);
  if (retter.length === 0) throw new Error("Fant ingen retter");

  // Steg 3: rett → andel
  const andeler = await registerenhetsrettsandelService!.findAndelerIRetter(
    retter[0]
  );
  console.log("andelIds (på matrikkelenheten):", andeler);
  if (andeler.length === 0) throw new Error("Fant ingen andeler");

  // Steg 4: andel → rettighetshaver
  const andel = await storeService!.getRegisterenhetsrettsandel(andeler[0]);
  console.log("andel:", andel);
  if (!andel.rettighetshaverId) throw new Error("Mangler rettighetshaverId");

  // Steg 5: person → org.nr/navn
  const person = await storeService!.getPerson(andel.rettighetshaverId);
  console.log("hjemmelshaver:", person);

  // Steg 6: org.nr → borettslagId
  const borettslagId = await identService!.findBorettslagId(
    person.identifikasjonsnummer
  );
  console.log("borettslagId:", borettslagId);
  if (!borettslagId) throw new Error("Fant ikke borettslag");

  // Steg 7: borettslagId → alle andeler
  const alleAndeler =
    await registerenhetService!.findBorettslagsandelerForBorettslag(
      borettslagId
    );
  console.log(`Totalt ${alleAndeler.length} andeler i ${person.navn}`);

  if (alleAndeler.length < 500) {
    throw new Error(
      `Forventet ~598 andeler, fikk ${alleAndeler.length}`
    );
  }

  // Bonus: hent adressen på en sample andel
  const sampleAndel = await storeService!.getBorettslagsandel(alleAndeler[0]);
  console.log("Sample andel:", sampleAndel);
  if (sampleAndel.adresseId) {
    const adresse = await storeService!.getAdresse(sampleAndel.adresseId);
    console.log("Sample adresse:", adresse);
  }
}

async function testHesteskoenSameie(): Promise<void> {
  console.log("\n=== HESTESKOEN SAMEIE (forventet ~196 seksjoner) ===");

  const matrikkelId = await identService!.findMatrikkelenhetId({
    kommunenummer: "0301",
    gaardsnummer: 73,
    bruksnummer: 739,
  });
  console.log("matrikkelenhetId:", matrikkelId);
  if (!matrikkelId) throw new Error("Fant ikke matrikkelenhet");

  const seksjoner = await registerenhetService!.findSeksjonerFor(matrikkelId);
  console.log(`Totalt ${seksjoner.length} seksjoner`);

  if (seksjoner.length < 100) {
    throw new Error(`Forventet ~196 seksjoner, fikk ${seksjoner.length}`);
  }

  // Bonus: hent en sample seksjon
  const sampleSeksjon = await storeService!.getSeksjon(seksjoner[0]);
  console.log("Sample seksjon:", sampleSeksjon);
}

async function main() {
  await assertAvailable();
  await testOppsalBorettslag();
  await testHesteskoenSameie();
  console.log("\n✓ Alle testene gikk OK");
}

main().catch((err) => {
  console.error("\n✗ Feilet:", err);
  process.exit(1);
});
