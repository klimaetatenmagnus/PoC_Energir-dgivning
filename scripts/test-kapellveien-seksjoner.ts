// Test av Kapellveien 156 B og C - tomannsbolig med separate bygningsnumre
import "../loadEnv.ts";
import { resolveBuildingData } from "../services/building-info-service/index.ts";

async function testKapellveien() {
  console.log("=== TEST AV KAPELLVEIEN 156 B OG C ===");
  console.log("Tomannsbolig med separate bygningsnumre\n");
  
  const adresser = [
    "Kapellveien 156B, 0493 Oslo",
    "Kapellveien 156C, 0493 Oslo"
  ];
  
  const resultater = [];
  
  for (const adresse of adresser) {
    console.log(`\n--- Testing ${adresse} ---`);
    try {
      const result = await resolveBuildingData(adresse);
      resultater.push({ adresse, result });
      
      console.log(`✅ SUCCESS!`);
      console.log(`  GNR/BNR: ${result.gnr}/${result.bnr}`);
      console.log(`  Seksjonsnummer: ${result.seksjonsnummer || 'ikke funnet'}`);
      console.log(`  Matrikkelenhet ID: ${result.matrikkelenhetsId}`);
      console.log(`  Bygg ID: ${result.byggId}`);
      console.log(`  Bygningsnummer: ${result.bygningsnummer || 'ikke funnet'}`);
      console.log(`  Bruksareal: ${result.bruksarealM2} m²`);
      console.log(`  Bygningstype: ${result.bygningstype} (kode: ${result.bygningstypeKode || result.bygningstypeKodeId})`);
      console.log(`  Byggeår: ${result.byggeaar}`);
      
    } catch (error) {
      console.log(`❌ FEIL: ${error.message}`);
    }
  }
  
  // Sammenligning
  console.log("\n\n=== SAMMENLIGNING AV SEKSJONENE ===");
  console.log("┌─────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ Adresse            │ Seksjon │ Bygg ID   │ Bygningsnr │ Bruksareal │ Type      │");
  console.log("├─────────────────────────────────────────────────────────────────────────────────┤");
  
  for (const { adresse, result } of resultater) {
    const adr = adresse.substring(0, 18).padEnd(18);
    const sek = String(result.seksjonsnummer || '-').padEnd(7);
    const byggId = String(result.byggId || '-').padEnd(9);
    const byggNr = String(result.bygningsnummer || '-').padEnd(10);
    const areal = String(result.bruksarealM2 || '-').padEnd(10);
    const type = String(result.bygningstypeKode || result.bygningstypeKodeId || '-').padEnd(9);
    
    console.log(`│ ${adr} │ ${sek} │ ${byggId} │ ${byggNr} │ ${areal} │ ${type} │`);
  }
  console.log("└─────────────────────────────────────────────────────────────────────────────────┘");
  
  // Konklusjon
  console.log("\n=== KONKLUSJON ===");
  if (resultater.length === 2) {
    const [b, c] = resultater;
    const harUlikeByggnummer = b.result.bygningsnummer !== c.result.bygningsnummer;
    const harUlikeAreal = b.result.bruksarealM2 !== c.result.bruksarealM2;
    const harUlikeByggId = b.result.byggId !== c.result.byggId;
    
    console.log(`Ulike bygningsnummer: ${harUlikeByggnummer ? '✅ JA' : '❌ NEI'}`);
    console.log(`Ulike bygg-IDer: ${harUlikeByggId ? '✅ JA' : '❌ NEI'}`);
    console.log(`Ulike bruksarealer: ${harUlikeAreal ? '✅ JA' : '❌ NEI'}`);
    
    if (harUlikeByggnummer && harUlikeAreal) {
      console.log("\n✅ VELLYKKET: Kapellveien har separate bygningsnumre og vi får");
      console.log("   separate bruksarealer for hver seksjon!");
    } else if (!harUlikeByggnummer && !harUlikeAreal) {
      console.log("\n⚠️  Kapellveien har samme bygningsnummer og samme bruksareal");
      console.log("   Dette ligner på situasjonen med Kjelsåsveien 97 B");
    }
  }
}

testKapellveien().catch(console.error);