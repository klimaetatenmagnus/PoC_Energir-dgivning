// src/utils/soapDump.ts
import fs from "node:fs/promises";
import path from "node:path";

/** mappe der alle dump-filer havner  */
const DIR = path.resolve("soap-dumps");

// lag mappen én gang ved oppstart
await fs.mkdir(DIR, { recursive: true });

/** Fasen filen kan ha – samme som i klientene */
export type SoapPhase = "request" | "response" | "fault";

/**
 * Klientenes variant: (corrId, phase, xml)
 *
 * Filnavn: 2025-06-15T10-22-13.456Z.{corrId}.{phase}.xml
 */
export async function dumpSoap(
  corrId: string,
  phase: SoapPhase,
  xml: string
): Promise<void> {
  if (process.env.LIVE !== "1") return; // bare i live-modus

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(DIR, `${stamp}.${corrId}.${phase}.xml`);
    await fs.writeFile(file, xml, "utf8");
  } catch (err) {
    console.error("⚠️  Klarte ikke å skrive SOAP-dump-fil:", err);
  }
}

/**
 * Valgfri hjelper som bevarer det gamle (prefix, phase, xml, corrId)-mønsteret.
 *   dumpSoapWithPrefix("store")("request", xml, corrId)
 */
export const dumpSoapWithPrefix =
  (prefix: string) => async (phase: SoapPhase, xml: string, corrId?: string) =>
    dumpSoap(corrId ?? prefix, phase, xml);
