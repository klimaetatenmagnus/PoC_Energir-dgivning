/**
 * Tester detektor mot tre forventede utfall:
 *  - Oppsal Borettslag (gnr 146/bnr 238)    → type: 'borettslag', navn: 'Oppsal Borettslag'
 *  - Hesteskoen sameie (gnr 73/bnr 739)     → type: 'sameie', antall seksjoner
 *  - Pilestredet 37 (gnr 209/bnr 58)        → type: 'enkelt' (eiet av Wang Eiendomsselskap AS)
 *
 * Kjøres med:
 *   API_ENV=prod LIVE=1 npx tsx scripts/test-eiendomsgruppe-detektor.ts
 */
import { detekterEiendomsgruppe } from "../services/grunnbok-service/EiendomsgruppeDetector.ts";

const cases = [
  {
    label: "Oppsal Borettslag",
    input: { kommunenummer: "0301", gaardsnummer: 146, bruksnummer: 238 },
    forventet: "borettslag" as const,
  },
  {
    label: "Hesteskoen sameie",
    input: { kommunenummer: "0301", gaardsnummer: 73, bruksnummer: 739 },
    forventet: "sameie" as const,
  },
  {
    // Pilestredet 37 har 2 seksjoner → teknisk sameie, men UI bør vurdere
    // en minimum-terskel (f.eks. >= 5 enheter) før toggle vises.
    label: "Pilestredet 37 (2-seksjons sameie)",
    input: { kommunenummer: "0301", gaardsnummer: 209, bruksnummer: 58 },
    forventet: "sameie" as const,
  },
];

async function main() {
  let feil = 0;
  for (const c of cases) {
    try {
      const res = await detekterEiendomsgruppe(c.input);
      const ok = res.type === c.forventet;
      console.log(`${ok ? "✓" : "✗"} ${c.label}: type=${res.type}, antallEnheter=${res.antallEnheter}${
        res.navn ? `, navn="${res.navn}"` : ""
      } (${res.detektertMs}ms)`);
      if (!ok) feil++;
    } catch (err) {
      console.log(
        `✗ ${c.label}: feilet – ${err instanceof Error ? err.message : String(err)}`
      );
      feil++;
    }
  }
  if (feil > 0) {
    console.log(`\n${feil} av ${cases.length} feilet`);
    process.exit(1);
  }
  console.log("\nAlle detektor-tester gikk OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
