// src/utils/soapDump.ts
import { promises as fs } from "node:fs";
import path from "node:path";

/** Hvor dumpene lagres – endre om du ønsker en annen mappe. */
export const SOAP_DUMP_DIR = "/soap-dumps";

/**
 * Fase‐/statusfeltet som havner i filnavnet.
 *  - request/response/fault brukes av klientene
 *  - `http${number}` brukes når vi dumper et HTTP-feil-svar (f.eks. «http500»)
 */
export type SoapPhase = "request" | "response" | "fault" | `http${number}`;

/** Sørg for at dump‐mappen finnes (kjøres én gang ved import). */
await fs.mkdir(SOAP_DUMP_DIR, { recursive: true });

/**
 * Skriv SOAP‐/XML‐dump til fil.
 *
 * @param prefix  F.eks. «store», «bygning», «matrikkel»
 * @param phase   Se `SoapPhase`
 * @param xml     Selve meldingen / fault‐en
 * @param corrId  (valgfritt) correlation-id – tas med i filnavnet hvis den finnes
 */
export async function dumpSoap(
  prefix: string,
  phase: SoapPhase,
  xml: string,
  corrId?: string
): Promise<void> {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fname = corrId
      ? `${stamp}-${prefix}-${phase}-${corrId}.xml`
      : `${stamp}-${prefix}-${phase}.xml`;

    await fs.writeFile(path.join(SOAP_DUMP_DIR, fname), xml, "utf8");
  } catch (err) {
    // Unngå at feil i logging krasjer appen
    console.error("Kunne ikke skrive SOAP-dump:", err);
  }
}
