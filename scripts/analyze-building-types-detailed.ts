import { matrikkelClient } from '../src/clients/MatrikkelClient';
import { storeClient } from '../src/clients/StoreClient';
import { BygningClient } from '../src/clients/BygningClient';

// Test one specific problematic address to see ALL buildings
async function analyzeDetailedBuildingTypes() {
  process.env.LIVE = '1';
  
  // Create BygningClient instance
  const baseUrl = process.env.MATRIKKEL_TEST_URL || 'https://www.matrikkel.no/matrikkelapi/wsapi/v1';
  const username = process.env.MATRIKKEL_USERNAME || '';
  const password = process.env.MATRIKKEL_PASSWORD || '';
  const bygningClient = new BygningClient(baseUrl, username, password);
  
  const testAddress = "Strømsborgveien 42, Oslo";
  
  console.log(`=== DETAILED ANALYSIS FOR: ${testAddress} ===\n`);
  
  try {
    // 1. Først få adressen fra Geonorge
    const lookupAdresse = async (str: string) => {
      const headers = { headers: { "User-Agent": "Energitiltak/1.0" } };
      const buildUrl = (s: string) =>
        "https://ws.geonorge.no/adresser/v1/sok?" +
        new URLSearchParams({ sok: s, fuzzy: "true" })
          .toString()
          .replace(/\+/g, "%20");
      
      const resp = await fetch(buildUrl(str.replace(/\./g, "")), headers);
      const j = await resp.json() as any;
      if (!j.adresser?.length) throw new Error("Adressen ikke funnet");
      const a = j.adresser[0];
      return {
        kommunenummer: a.kommunenummer,
        gnr: a.gardsnummer,
        bnr: a.bruksnummer,
        adressekode: a.adressekode,
        husnummer: Number(a.nummer ?? a.husnummer ?? 0),
        bokstav: a.bokstav ?? "",
      };
    };
    
    const adr = await lookupAdresse(testAddress);
    console.log('Address info:', adr);
    
    // 2. Finn matrikkelenheter
    const ids = await matrikkelClient.findMatrikkelenheter(
      {
        kommunenummer: adr.kommunenummer,
        gnr: adr.gnr,
        bnr: adr.bnr,
        adressekode: adr.adressekode,
        husnummer: adr.husnummer,
        bokstav: adr.bokstav,
      },
      { correlationId: 'test' }
    );
    
    console.log(`\nFound ${ids.length} matrikkel units\n`);
    
    // 3. Get buildings from each matrikkel unit
    const allBuildings = new Map<string, any>();
    
    for (const id of ids) {
      console.log(`\nChecking matrikkel unit ${id}:`);
      
      const unit = await storeClient.getObject(id, "MatrikkelenhetId");
      
      if (unit?.matrikkelenhet?.bygning) {
        const bygninger = Array.isArray(unit.matrikkelenhet.bygning) 
          ? unit.matrikkelenhet.bygning 
          : [unit.matrikkelenhet.bygning];
        
        for (const bygg of bygninger) {
          const bygningsId = bygg.bygningId || bygg.id;
          if (!bygningsId) continue;
          
          if (!allBuildings.has(bygningsId)) {
            // Get full building details
            const fullBuilding = await bygningClient.getBygning(bygningsId);
            
            console.log(`\n  Building ${bygningsId}:`);
            console.log(`    Number: ${fullBuilding.bygningsnummer || 'N/A'}`);
            console.log(`    Type ID: ${fullBuilding.bygningstypeKodeId || 'N/A'}`);
            console.log(`    Type: ${fullBuilding.bygningstypeKode || 'N/A'}`);
            console.log(`    Area: ${fullBuilding.bruksarealM2 || 0} m²`);
            console.log(`    Status: ${fullBuilding.bygningsstatusKode || 'N/A'}`);
            console.log(`    Year: ${fullBuilding.registreringsdato || 'N/A'}`);
            
            // Check if it's residential
            const typeId = fullBuilding.bygningstypeKodeId;
            const isResidential = typeId && typeId >= 1 && typeId <= 17;
            console.log(`    Residential: ${isResidential ? 'YES' : 'NO'}`);
            
            allBuildings.set(bygningsId, fullBuilding);
          }
        }
      }
    }
    
    console.log(`\n\nTOTAL UNIQUE BUILDINGS: ${allBuildings.size}`);
    
    // Analyze building types
    console.log('\n=== BUILDING TYPE ANALYSIS ===');
    const typeCount = new Map<string, number>();
    const residentialBuildings = [];
    const nonResidentialBuildings = [];
    
    for (const [id, building] of allBuildings) {
      const typeDesc = `${building.bygningstypeKodeId || '?'} - ${building.bygningstypeKode || 'Unknown'}`;
      typeCount.set(typeDesc, (typeCount.get(typeDesc) || 0) + 1);
      
      const typeId = building.bygningstypeKodeId;
      if (typeId && typeId >= 1 && typeId <= 17) {
        residentialBuildings.push(building);
      } else {
        nonResidentialBuildings.push(building);
      }
    }
    
    console.log('\nBuilding types found:');
    for (const [type, count] of typeCount) {
      console.log(`  ${type}: ${count} building(s)`);
    }
    
    console.log(`\nResidential buildings: ${residentialBuildings.length}`);
    console.log(`Non-residential buildings: ${nonResidentialBuildings.length}`);
    
    // Show what we're filtering out
    if (nonResidentialBuildings.length > 0) {
      console.log('\n=== NON-RESIDENTIAL BUILDINGS (could be filtered) ===');
      for (const building of nonResidentialBuildings) {
        console.log(`  ${building.bygningsnummer} - ${building.bygningstypeKode} (${building.bruksarealM2 || 0} m²)`);
      }
    }
    
    // Show residential buildings sorted by different criteria
    if (residentialBuildings.length > 1) {
      console.log('\n=== RESIDENTIAL BUILDINGS ANALYSIS ===');
      
      // Sort by building number
      const byNumber = [...residentialBuildings].sort((a, b) => {
        const aNum = parseInt(a.bygningsnummer || '0');
        const bNum = parseInt(b.bygningsnummer || '0');
        return aNum - bNum;
      });
      
      console.log('\nSorted by building number:');
      byNumber.forEach(b => {
        console.log(`  ${b.bygningsnummer} - ${b.bygningstypeKode} (${b.bruksarealM2 || 0} m²)`);
      });
      
      // Check for high-numbered buildings
      const highNumbered = residentialBuildings.filter(b => {
        const num = parseInt(b.bygningsnummer || '0');
        return num >= 80000000;
      });
      
      if (highNumbered.length > 0) {
        console.log(`\n⚠️  Found ${highNumbered.length} high-numbered (80/81-series) residential buildings`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzeDetailedBuildingTypes().catch(console.error);