// Test av seksjonsnummer for Kapellveien med bedre håndtering
import "../loadEnv.ts";
import { MatrikkelClient } from "../src/clients/MatrikkelClient.ts";
import { matrikkelEndpoint } from "../src/utils/endpoints.ts";

const BASE_URL = process.env.MATRIKKEL_API_BASE_URL_PROD || "https://www.matrikkel.no/matrikkelapi/wsapi/v1";
const USERNAME = process.env.MATRIKKEL_USERNAME!;
const PASSWORD = process.env.MATRIKKEL_PASSWORD!;

const matrikkelClient = new MatrikkelClient(
  matrikkelEndpoint(BASE_URL, "MatrikkelenhetService"),
  USERNAME,
  PASSWORD
);

const ctx = () => ({
  locale: "no_NO_B",
  brukOriginaleKoordinater: true,
  koordinatsystemKodeId: 25833,
  systemVersion: "trunk",
  klientIdentifikasjon: "test-script",
  snapshotVersion: { timestamp: "9999-01-01T00:00:00+01:00" },
});

async function findSections() {
  console.log("=== SØKER ETTER SEKSJONER FOR KAPELLVEIEN 156 ===\n");
  
  // Søk etter alle matrikkelenheter på gnr/bnr
  const allUnits = await matrikkelClient.findMatrikkelenheter({
    kommunenummer: "0301",
    gnr: 73,
    bnr: 704
  }, ctx());
  
  console.log(`Fant ${allUnits.length} matrikkelenheter på 73/704\n`);
  
  // Prøv å hente hver enhet via getMatrikkelenhet i stedet
  for (const unitId of allUnits) {
    console.log(`\n📍 Undersøker matrikkelenhet ${unitId}:`);
    
    try {
      // Hent full matrikkelenhet
      const matrikkelenhet = await matrikkelClient.getMatrikkelenhet(unitId, ctx());
      
      console.log("  Type:", matrikkelenhet?.constructor?.name || typeof matrikkelenhet);
      
      // Sjekk alle relevante felt
      if (matrikkelenhet) {
        // @ts-ignore - vi vet ikke strukturen helt
        const props = [
          'matrikkelnummer',
          'seksjonsnummer', 
          'eierseksjonsnummer',
          'bruksenhetsnummer',
          'adresser',
          'vegadresser',
          'eierseksjoner'
        ];
        
        for (const prop of props) {
          if (prop in matrikkelenhet) {
            const value = matrikkelenhet[prop];
            if (value !== undefined && value !== null) {
              console.log(`  ${prop}:`, JSON.stringify(value, null, 2));
            }
          }
        }
        
        // Sjekk om det er en eierseksjon
        // @ts-ignore
        if (matrikkelenhet.eierseksjoner && Array.isArray(matrikkelenhet.eierseksjoner)) {
          console.log(`  ✅ HAR ${matrikkelenhet.eierseksjoner.length} EIERSEKSJONER!`);
          // @ts-ignore
          for (const eierseksjon of matrikkelenhet.eierseksjoner) {
            console.log("    Eierseksjon:", {
              seksjonsnummer: eierseksjon.seksjonsnummer,
              bruksenhetsnummer: eierseksjon.bruksenhetsnummer,
              adresse: eierseksjon.adresse
            });
          }
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Feil: ${error.message}`);
    }
  }
  
  console.log("\n\n💡 KONKLUSJON:");
  console.log("Basert på Kartverkets weboppslag finnes det definitivt seksjoner:");
  console.log("- 0301-73/704/0/1 (156B)");
  console.log("- 0301-73/704/0/2 (156C)");
  console.log("\nVi må finne riktig måte å hente disse på via API-et.");
}

findSections().catch(console.error);