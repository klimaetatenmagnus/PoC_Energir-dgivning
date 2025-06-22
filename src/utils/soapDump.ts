// src/utils/soapDump.ts
import fs from "node:fs/promises";
import path from "node:path";

/** mappe der alle dump-filer havner  */
const DIR = path.resolve("soap-dumps");

// lag mappen én gang ved oppstart
await fs.mkdir(DIR, { recursive: true });

/**
 * Rydder opp i SOAP-dump mappen ved å beholde kun de 12 nyeste filene
 */
async function cleanupOldDumps(): Promise<void> {
  try {
    const files = await fs.readdir(DIR);
    const xmlFiles = files.filter(f => f.endsWith('.xml'));
    
    if (xmlFiles.length <= 12) return; // Ingen opprydding nødvendig
    
    // Hent filstats for sortering etter modifiseringstid
    const fileStats = await Promise.all(
      xmlFiles.map(async (file) => {
        const filePath = path.join(DIR, file);
        const stats = await fs.stat(filePath);
        return { file, path: filePath, mtime: stats.mtime };
      })
    );
    
    // Sorter etter modifiseringstid (eldste først)
    fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
    
    // Slett de eldste filene utover 12
    const filesToDelete = fileStats.slice(0, fileStats.length - 12);
    
    for (const { path: filePath } of filesToDelete) {
      await fs.unlink(filePath);
    }
    
    if (filesToDelete.length > 0) {
      console.log(`🧹 Slettet ${filesToDelete.length} gamle SOAP-dump filer`);
    }
  } catch (err) {
    console.error("⚠️  Feil ved opprydding av SOAP-dump filer:", err);
  }
}

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
 * Eksportert funksjon for å rydde opp i gamle dump-filer
 * Kalles fra test-script for å begrense antall filer
 */
export async function cleanupSoapDumps(): Promise<void> {
  await cleanupOldDumps();
}

/**
 * Valgfri hjelper som bevarer det gamle (prefix, phase, xml, corrId)-mønsteret.
 *   dumpSoapWithPrefix("store")("request", xml, corrId)
 */
export const dumpSoapWithPrefix =
  (prefix: string) => async (phase: SoapPhase, xml: string, corrId?: string) =>
    dumpSoap(corrId ?? prefix, phase, xml);
