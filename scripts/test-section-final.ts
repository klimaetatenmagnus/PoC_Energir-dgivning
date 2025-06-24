import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

async function test() {
  console.log("=== TEST AV SEKSJONSINFERENS ===\n");
  
  const addresses = [
    "Kapellveien 156B, 0493 Oslo",
    "Kapellveien 156C, 0493 Oslo"
  ];
  
  for (const addr of addresses) {
    console.log(`\nTesting ${addr}...`);
    const result = await resolveBuildingData(addr);
    
    console.log(`\n✅ RESULTAT for ${addr}:`);
    console.log(`  Bruksareal: ${result.bruksarealM2} m²`);
    console.log(`  Bygningsnummer: ${result.bygningsnummer}`);
    console.log(`  Seksjonsnummer (Matrikkel): ${result.seksjonsnummer || 'ingen'}`);
    console.log(`  Seksjonsnummer (inferert): ${result.seksjonsnummerInferert || 'ingen'}`);
    console.log(`  Energiattest funnet: ${result.energiattest ? 'JA' : 'NEI'}`);
  }
}

test().catch(console.error);