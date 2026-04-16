/**
 * EiendomsgruppeDetector — rask sjekk om en eiendom tilhører borettslag eller sameie.
 *
 * Kjøres typisk speculativt under side 1 → side 2-overgangen i UI. Returnerer
 * nok informasjon til å vise "Henter data for X borettslag/sameie"-loader før
 * den tyngre aggregeringen er ferdig.
 */
import {
  identService,
  registerenhetService,
  registerenhetsrettService,
  registerenhetsrettsandelService,
  storeService,
  grunnbokEnabled,
} from "./context.ts";

export type EiendomsgruppeType = "borettslag" | "sameie" | "enkelt";

export interface EiendomsgruppeDetection {
  type: EiendomsgruppeType;
  navn?: string;
  organisasjonsnummer?: string;
  borettslagId?: string;
  matrikkelenhetRot?: {
    kommunenummer: string;
    gaardsnummer: number;
    bruksnummer: number;
  };
  antallEnheter: number;
  detektertMs: number;
}

export interface DetekterInput {
  kommunenummer: string;
  gaardsnummer: number;
  bruksnummer: number;
}

/**
 * Rask detektering: prioriterer sameie-sjekk (raskere) før borettslag.
 */
export async function detekterEiendomsgruppe(
  input: DetekterInput
): Promise<EiendomsgruppeDetection> {
  const start = Date.now();

  if (
    !grunnbokEnabled() ||
    !identService ||
    !registerenhetService ||
    !registerenhetsrettService ||
    !registerenhetsrettsandelService ||
    !storeService
  ) {
    return {
      type: "enkelt",
      antallEnheter: 1,
      detektertMs: Date.now() - start,
    };
  }

  // Steg 1: finn Grunnbok-matrikkelenhet
  const gbMatId = await identService.findMatrikkelenhetId(input);
  if (!gbMatId) {
    return {
      type: "enkelt",
      antallEnheter: 1,
      detektertMs: Date.now() - start,
    };
  }

  // Steg 2: parallellkjør sameie-sjekk og borettslag-kjeden
  const [seksjonIds, retter] = await Promise.all([
    registerenhetService.findSeksjonerFor(gbMatId),
    registerenhetsrettService.findRetterForEnheter(gbMatId),
  ]);

  // Hvis det finnes seksjoner → sameie
  if (seksjonIds.length > 0) {
    return {
      type: "sameie",
      matrikkelenhetRot: input,
      antallEnheter: seksjonIds.length,
      detektertMs: Date.now() - start,
    };
  }

  // Ellers: sjekk om hjemmelshaver er et borettslag
  if (retter.length === 0) {
    return {
      type: "enkelt",
      antallEnheter: 1,
      detektertMs: Date.now() - start,
    };
  }

  const andeler = await registerenhetsrettsandelService.findAndelerIRetter(retter[0]);
  if (andeler.length === 0) {
    return {
      type: "enkelt",
      antallEnheter: 1,
      detektertMs: Date.now() - start,
    };
  }

  // Hent den første andelen for å få rettighetshaverId
  const andel = await storeService.getRegisterenhetsrettsandel(andeler[0]);
  if (!andel.rettighetshaverId) {
    return {
      type: "enkelt",
      antallEnheter: 1,
      detektertMs: Date.now() - start,
    };
  }

  const person = await storeService.getPerson(andel.rettighetshaverId);

  // Borettslag-kriterier: juridisk person hvor navn inneholder "Borettslag"
  // (inkluderer "borettslag", "Brl", "B/L" etc. men vi holder oss til det enkle)
  const erBorettslag =
    person.type === "juridisk" &&
    /borettslag|boligbyggelag/i.test(person.navn);

  if (!erBorettslag) {
    return {
      type: "enkelt",
      antallEnheter: 1,
      detektertMs: Date.now() - start,
    };
  }

  // Finn borettslagId og antall andeler
  const borettslagId = await identService.findBorettslagId(
    person.identifikasjonsnummer
  );
  if (!borettslagId) {
    // Fant navn med "Borettslag" men ingen BorettslagId → trolig ikke aktivt
    // i Grunnbok (sjelden, men mulig). Returner som enkelt bolig.
    return {
      type: "enkelt",
      antallEnheter: 1,
      detektertMs: Date.now() - start,
    };
  }

  const alleAndeler =
    await registerenhetService.findBorettslagsandelerForBorettslag(borettslagId);

  return {
    type: "borettslag",
    navn: person.navn,
    organisasjonsnummer: person.identifikasjonsnummer,
    borettslagId,
    antallEnheter: alleAndeler.length,
    detektertMs: Date.now() - start,
  };
}
