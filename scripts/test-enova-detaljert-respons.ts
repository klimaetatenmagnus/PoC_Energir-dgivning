// scripts/test-enova-detaljert-respons.ts
// ─────────────────────────────────────────────────────────────────────────────
// Undersøker Enova enkelt-API (POST /Energiattest) for å se om den
// detaljerte responsen inneholder oppvarmingstype/energikilde-felter
// som IKKE finnes i bulk-CSV.
//
// Tester med noen kjente bygninger (inkl. de 3 med Matrikkel energikilde-kode 7).
//
// Kjør:  LIVE=1 npx tsx scripts/test-enova-detaljert-respons.ts
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "../loadEnv.ts";

/* ─────────────────────────── Config ──────────────────────────── */

const ENOVA_KEY = process.env.ENOVA_API_KEY;
const IS_LIVE = process.env.LIVE === "1";

// Testadresser: noen kjente bygninger + de tre med Matrikkel energikilde-kode 7
const TEST_BYGNINGER = [
  // De 3 bygningene med energikilde-kode 7 fra forrige undersøkelse
  { label: "Kristoffer Robins vei 64 (kode 7)", kommunenummer: "0301", gnr: 88, bnr: 182 },
  { label: "Holmlia Senter vei 15 (kode 7)", kommunenummer: "0301", gnr: 185, bnr: 58 },
  { label: "Selvbyggerveien 127 (kode 7)", kommunenummer: "0301", gnr: 130, bnr: 17 },
  // Noen kontrollbygninger (kjente blokker i sentrale bydeler med fjernvarme)
  { label: "Grønlandsleiret 73 (sentrum)", kommunenummer: "0301", gnr: 234, bnr: 133 },
  { label: "Tøyengata 2 (Gamle Oslo)", kommunenummer: "0301", gnr: 228, bnr: 41 },
  // Småhus (trolig ikke fjernvarme)
  { label: "Holmenveien 1 (Vestre Aker)", kommunenummer: "0301", gnr: 30, bnr: 60 },
];

/* ─────────────────────────── API-kall ────────────────────────── */

async function fetchEnovaFullResponse(params: {
  kommunenummer: string;
  gnr: number;
  bnr: number;
}): Promise<unknown> {
  const body: Record<string, string> = {
    kommunenummer: params.kommunenummer,
    gardsnummer: String(params.gnr),
    bruksnummer: String(params.bnr),
  };

  const response = await fetch(
    "https://api.data.enova.no/ems/offentlige-data/v1/Energiattest",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Energitiltak/1.0",
        "x-api-key": ENOVA_KEY!,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    return { error: `HTTP ${response.status}`, statusText: response.statusText };
  }

  return response.json();
}

/* ──────────── Rekursiv feltoversikt ──────────────────────────── */

function collectFieldPaths(obj: unknown, prefix = "", depth = 0, maxDepth = 6): string[] {
  if (depth > maxDepth || obj === null || obj === undefined) return [];

  const paths: string[] = [];

  if (Array.isArray(obj)) {
    paths.push(`${prefix} [Array(${obj.length})]`);
    if (obj.length > 0) {
      // Bare analyser første element
      paths.push(...collectFieldPaths(obj[0], `${prefix}[0]`, depth + 1, maxDepth));
    }
  } else if (typeof obj === "object") {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (val === null || val === undefined) {
        paths.push(`${fullPath} = null`);
      } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        paths.push(`${fullPath} = ${JSON.stringify(val)}`);
      } else {
        paths.push(...collectFieldPaths(val, fullPath, depth + 1, maxDepth));
      }
    }
  }

  return paths;
}

/* ──────────── Søk etter oppvarmings-relaterte felter ─────────── */

function findHeatingRelatedFields(obj: unknown, prefix = ""): string[] {
  const heatingKeywords = [
    "oppvarming", "heating", "varme", "fjernvarme", "energikilde",
    "energy.source", "energysource", "varmepumpe", "heat.pump",
    "sentralvarme", "vannbåren", "vannbaaren", "elektrisk",
    "oljefyr", "biobrensel", "pellets", "energiforsyning",
    "forsyning", "supply", "fuel", "brensel",
  ];
  const results: string[] = [];

  function walk(node: unknown, path: string) {
    if (node === null || node === undefined) return;

    if (Array.isArray(node)) {
      if (node.length > 0) walk(node[0], `${path}[0]`);
      return;
    }

    if (typeof node === "object") {
      for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
        const fullPath = path ? `${path}.${key}` : key;
        const lowerKey = key.toLowerCase();

        if (heatingKeywords.some((kw) => lowerKey.includes(kw))) {
          results.push(`${fullPath} = ${JSON.stringify(val)}`);
        }

        walk(val, fullPath);
      }
    }
  }

  walk(obj, prefix);
  return results;
}

/* ─────────────────────────── Main ────────────────────────────── */

async function main() {
  if (!IS_LIVE) {
    console.error("Kjør med LIVE=1 for å gjøre faktiske API-kall.");
    process.exit(1);
  }
  if (!ENOVA_KEY) {
    console.error("Mangler ENOVA_API_KEY i miljøet.");
    process.exit(1);
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("  ENOVA ENKELT-API: DETALJERT RESPONSANALYSE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`API-nøkkel: ${ENOVA_KEY.slice(0, 8)}...`);

  const allFieldPaths = new Set<string>();
  const heatingFieldsPerBygning: { label: string; fields: string[] }[] = [];

  for (const bygning of TEST_BYGNINGER) {
    console.log(`\n── ${bygning.label} (GNR ${bygning.gnr}/BNR ${bygning.bnr}) ──`);

    try {
      const data = await fetchEnovaFullResponse(bygning);

      if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
        console.log(`  Feil: ${JSON.stringify(data)}`);
        continue;
      }

      // 1) Dump fullstendig respons
      const jsonStr = JSON.stringify(data, null, 2);
      console.log(`  Responsstørrelse: ${jsonStr.length} tegn`);

      // Lagre fullstendig respons til fil (for analyse)
      const safeLabel = bygning.label.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const outFile = path.resolve(
        import.meta.dirname ?? ".",
        `../workspace-archive/enova-respons-${safeLabel}.json`
      );
      fs.writeFileSync(outFile, jsonStr, "utf-8");
      console.log(`  Lagret til: ${outFile}`);

      // 2) Feltoversikt
      const fields = collectFieldPaths(data);
      for (const f of fields) {
        // Normaliser array-indekser for å finne unike felt-stier
        allFieldPaths.add(f.replace(/\[\d+\]/g, "[*]"));
      }

      // 3) Oppvarmings-relaterte felter
      const heatingFields = findHeatingRelatedFields(data);
      heatingFieldsPerBygning.push({ label: bygning.label, fields: heatingFields });

      if (heatingFields.length > 0) {
        console.log(`  Oppvarmings-relaterte felter (${heatingFields.length}):`);
        for (const f of heatingFields) {
          console.log(`    ${f}`);
        }
      } else {
        console.log("  Ingen oppvarmings-relaterte felter funnet.");
      }

      // 4) Vis noen nøkkelfelter
      const list = Array.isArray(data) ? data : [data];
      for (const item of list.slice(0, 2)) {
        const attest = (item as Record<string, unknown>)?.energiattest as Record<string, unknown> | undefined;
        const enhet = (item as Record<string, unknown>)?.enhet as Record<string, unknown> | undefined;
        if (attest) {
          console.log(`  Energikarakter: ${attest.energikarakter}`);
          console.log(`  Oppvarmingskarakter: ${attest.oppvarmingskarakter}`);

          // Sjekk om det finnes registering med detaljer
          const reg = attest.registering as Record<string, unknown> | undefined;
          if (reg) {
            console.log(`  Registering-felter: ${Object.keys(reg).join(", ")}`);
          }
        }
        if (enhet) {
          console.log(`  Enhet-felter: ${Object.keys(enhet).join(", ")}`);
          const bygg = enhet.bygg as Record<string, unknown> | undefined;
          if (bygg) {
            console.log(`  Bygg-felter: ${Object.keys(bygg).join(", ")}`);
          }
        }
      }
    } catch (err) {
      console.error(`  Feil: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Forsinkelse mellom kall
    await new Promise((r) => setTimeout(r, 500));
  }

  // ─── Oppsummering ───
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  OPPSUMMERING: ALLE UNIKE FELT-STIER");
  console.log("═══════════════════════════════════════════════════");
  const sortedPaths = [...allFieldPaths].sort();
  for (const p of sortedPaths) {
    console.log(`  ${p}`);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  OPPVARMINGS-RELATERTE FELTER PER BYGNING");
  console.log("═══════════════════════════════════════════════════");
  for (const { label, fields } of heatingFieldsPerBygning) {
    console.log(`\n  ${label}:`);
    if (fields.length === 0) {
      console.log("    (ingen funnet)");
    } else {
      for (const f of fields) {
        console.log(`    ${f}`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  KONKLUSJON");
  console.log("═══════════════════════════════════════════════════");

  const anyHeatingFound = heatingFieldsPerBygning.some((b) => b.fields.length > 0);
  if (anyHeatingFound) {
    console.log("  Enova enkelt-API inneholder oppvarmings-relaterte felter!");
    console.log("  Se detaljene over for hvilke felter som er tilgjengelige.");
  } else {
    console.log("  Enova enkelt-API ser IKKE ut til aa ha eksplisitte oppvarmingstype-felter");
    console.log("  utover det som allerede finnes i bulk-CSV.");
  }

  console.log("\n═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal feil:", err);
  process.exit(1);
});
