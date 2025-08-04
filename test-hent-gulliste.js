// Hent eksempler fra gul liste for å se teigid-format

async function hentGulListeEksempler() {
  console.log("=== HENTER EKSEMPLER FRA GUL LISTE ===\n");
  
  // Hent noen få eksempler fra gul liste
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon&` +
    `maxFeatures=10`;
  
  console.log("Henter 10 første eiendommer fra gul liste...\n");
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (xml.includes("<gml:featureMember>")) {
      console.log("✅ Fant eiendommer på gul liste!\n");
      
      // Finn alle teigid
      const teigidMatches = xml.matchAll(/<ms:teigid>(\d+)<\/ms:teigid>/g);
      const gnrMatches = xml.matchAll(/<ms:gnr>(\d+)<\/ms:gnr>/g);
      const bnrMatches = xml.matchAll(/<ms:bnr>(\d+)<\/ms:bnr>/g);
      const fnrMatches = xml.matchAll(/<ms:fnr>(\d+)<\/ms:fnr>/g);
      const adresseMatches = xml.matchAll(/<ms:adresse>(.*?)<\/ms:adresse>/g);
      
      const teigider = [...teigidMatches].map(m => m[1]);
      const gnrs = [...gnrMatches].map(m => m[1]);
      const bnrs = [...bnrMatches].map(m => m[1]);
      const fnrs = [...fnrMatches].map(m => m[1]);
      const adresser = [...adresseMatches].map(m => m[1]);
      
      console.log("EKSEMPLER PÅ TEIGID-FORMAT:");
      console.log("=" * 60);
      
      for (let i = 0; i < Math.min(10, teigider.length); i++) {
        console.log(`\nEksempel ${i + 1}:`);
        console.log(`  Teigid: ${teigider[i]} (${teigider[i].length} siffer)`);
        if (gnrs[i]) console.log(`  GNR: ${gnrs[i]}`);
        if (bnrs[i]) console.log(`  BNR: ${bnrs[i]}`);
        if (fnrs[i]) console.log(`  FNR: ${fnrs[i]}`);
        if (adresser[i]) console.log(`  Adresse: ${adresser[i]}`);
        
        // Analyser teigid-struktur
        if (teigider[i] && gnrs[i] && bnrs[i]) {
          console.log(`  Analyse: Hvis GNR=${gnrs[i]}, BNR=${bnrs[i]}, FNR=${fnrs[i] || '?'}`);
          
          // Sjekk om det matcher noen kjente formater
          const muligFormat1 = gnrs[i].padStart(3, '0') + bnrs[i].padStart(4, '0') + (fnrs[i] || '0').padStart(2, '0');
          const muligFormat2 = gnrs[i] + bnrs[i].padStart(4, '0') + (fnrs[i] || '0').padStart(2, '0');
          
          if (teigider[i] === muligFormat1) {
            console.log(`  ✓ Matcher format: gnr(3) + bnr(4) + fnr(2)`);
          } else if (teigider[i] === muligFormat2) {
            console.log(`  ✓ Matcher format: gnr + bnr(4) + fnr(2)`);
          } else {
            console.log(`  ? Format matcher ikke standard mønstre`);
          }
        }
      }
      
      // Søk spesifikt etter GNR 28
      console.log("\n" + "=" * 60);
      console.log("SØKER ETTER GNR 28 I LISTEN...\n");
      
      const gnr28Matches = xml.matchAll(/<ms:eiendom_polygon>[\s\S]*?<ms:gnr>28<\/ms:gnr>[\s\S]*?<\/ms:eiendom_polygon>/g);
      let funnetGnr28 = false;
      
      for (const match of gnr28Matches) {
        funnetGnr28 = true;
        const content = match[0];
        const teigid = content.match(/<ms:teigid>(\d+)<\/ms:teigid>/)?.[1];
        const bnr = content.match(/<ms:bnr>(\d+)<\/ms:bnr>/)?.[1];
        const fnr = content.match(/<ms:fnr>(\d+)<\/ms:fnr>/)?.[1];
        const adresse = content.match(/<ms:adresse>(.*?)<\/ms:adresse>/)?.[1];
        
        console.log(`Funnet GNR 28:`);
        console.log(`  Teigid: ${teigid}`);
        console.log(`  BNR: ${bnr}`);
        console.log(`  FNR: ${fnr || '0'}`);
        console.log(`  Adresse: ${adresse}`);
        
        if (bnr === '138') {
          console.log(`  ⚠️ DETTE ER GNR 28, BNR 138!`);
        }
        console.log();
      }
      
      if (!funnetGnr28) {
        console.log("Ingen eiendommer med GNR 28 i de første 10 resultatene.");
        console.log("Prøver å hente flere...\n");
        
        // Hent flere resultater
        await hentFlereResultater();
      }
      
    } else {
      console.log("❌ Ingen data returnert");
    }
  } catch (error) {
    console.error("Feil:", error.message);
  }
}

async function hentFlereResultater() {
  // Hent mange flere for å finne GNR 28
  const url = `https://od2.pbe.oslo.kommune.no/cgi-bin/wms?` +
    `map=EIENDOM_TABELL&tabell=kart.gulliste_spatial&` +
    `service=WFS&version=1.1.0&request=GetFeature&` +
    `typeName=eiendom_polygon&` +
    `maxFeatures=1000`;
  
  console.log("Henter opptil 1000 eiendommer for å finne GNR 28...\n");
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    // Tell antall med GNR 28
    const gnr28Count = (xml.match(/<ms:gnr>28<\/ms:gnr>/g) || []).length;
    console.log(`Fant ${gnr28Count} eiendommer med GNR 28\n`);
    
    if (gnr28Count > 0) {
      // Finn alle GNR 28 med BNR
      const gnr28Matches = xml.matchAll(/<ms:eiendom_polygon>[\s\S]*?<ms:gnr>28<\/ms:gnr>[\s\S]*?<\/ms:eiendom_polygon>/g);
      
      console.log("GNR 28 eiendommer på gul liste:");
      for (const match of gnr28Matches) {
        const content = match[0];
        const teigid = content.match(/<ms:teigid>(\d+)<\/ms:teigid>/)?.[1];
        const bnr = content.match(/<ms:bnr>(\d+)<\/ms:bnr>/)?.[1];
        const fnr = content.match(/<ms:fnr>(\d+)<\/ms:fnr>/)?.[1];
        const adresse = content.match(/<ms:adresse>(.*?)<\/ms:adresse>/)?.[1];
        
        console.log(`  GNR 28, BNR ${bnr}, FNR ${fnr || '0'}: teigid=${teigid}, adresse="${adresse}"`);
        
        if (bnr === '138') {
          console.log(`  ⚠️⚠️⚠️ FUNNET: GNR 28, BNR 138 har teigid: ${teigid}`);
        }
      }
    }
  } catch (error) {
    console.error("Feil ved henting av flere resultater:", error.message);
  }
}

// Kjør test
hentGulListeEksempler();