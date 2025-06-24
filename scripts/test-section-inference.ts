// Test av seksjonsinferens basert på bokstav i adresse
import "../loadEnv.ts";

// Funksjon for å inferere seksjonsnummer fra bokstav
function inferSectionNumberFromLetter(bokstav: string): number | null {
  if (!bokstav || bokstav.length !== 1) return null;
  
  const letter = bokstav.toUpperCase();
  if (letter < 'A' || letter > 'Z') return null;
  
  // A = seksjon 1, B = seksjon 2, osv.
  return letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
}

// Test cases
const testCases = [
  { address: "Kjelsåsveien 97B", bokstav: "B", expectedSection: 2 },
  { address: "Kapellveien 156B", bokstav: "B", expectedSection: 2 },
  { address: "Kapellveien 156C", bokstav: "C", expectedSection: 3 },
  { address: "Someveien 123A", bokstav: "A", expectedSection: 1 },
  { address: "Annenveien 45", bokstav: "", expectedSection: null },
];

console.log("=== TEST AV SEKSJONSINFERENS FRA BOKSTAV ===\n");
console.log("Adresse                  │ Bokstav │ Inferert seksjon │ Status");
console.log("─".repeat(65));

for (const test of testCases) {
  const inferred = inferSectionNumberFromLetter(test.bokstav);
  const status = inferred === test.expectedSection ? "✅" : "❌";
  
  console.log(
    `${test.address.padEnd(23)} │ ${test.bokstav.padEnd(7)} │ ` +
    `${String(inferred || '-').padEnd(16)} │ ${status}`
  );
}

console.log("\n💡 FORSLAG TIL IMPLEMENTASJON:");
console.log("I building-info-service/index.ts, etter at seksjonsnummer er hentet:");
console.log(`
// Hvis ingen seksjonsnummer i Matrikkel men adresse har bokstav, infer seksjon
if (!seksjonsnummer && adr.bokstav) {
  const inferredSection = adr.bokstav.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  if (LOG) console.log(\`📐 Ingen seksjonsnummer i Matrikkel, infererer seksjon \${inferredSection} fra bokstav \${adr.bokstav}\`);
  
  // Bruk inferert seksjon for Enova-oppslag
  const attest = await fetchEnergiattest({
    kommunenummer: adr.kommunenummer,
    gnr: adr.gnr,
    bnr: adr.bnr,
    seksjonsnummer: inferredSection,  // <-- Inferert fra bokstav
    bygningsnummer: bygg.bygningsnummer,
  });
}
`);

console.log("\nDette vil hjelpe Enova API å finne riktig energiattest for seksjonen.");