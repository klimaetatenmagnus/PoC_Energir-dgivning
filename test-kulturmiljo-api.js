async function sjekkKulturmiljo(lat, lon) {
  // Konverter lat/lon til UTM32 (EPSG:32632)
  // Mer nøyaktig konvertering for Oslo
  const a = 6378137.0; // WGS84 semi-major axis
  const e = 0.081819190842622; // WGS84 eccentricity
  
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  const zone = 32;
  const centralMeridian = (zone - 1) * 6 - 180 + 3;
  const centralMeridianRad = centralMeridian * Math.PI / 180;
  
  const n = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const t = Math.tan(latRad) * Math.tan(latRad);
  const c = e * e * Math.cos(latRad) * Math.cos(latRad) / (1 - e * e);
  const A = (lonRad - centralMeridianRad) * Math.cos(latRad);
  
  const M = a * ((1 - e * e / 4 - 3 * e * e * e * e / 64) * latRad
    - (3 * e * e / 8 + 3 * e * e * e * e / 32) * Math.sin(2 * latRad)
    + (15 * e * e * e * e / 256) * Math.sin(4 * latRad));
  
  const utm_x = 0.9996 * n * (A + (1 - t + c) * A * A * A / 6) + 500000;
  const utm_y = 0.9996 * (M + n * Math.tan(latRad) * (A * A / 2 + (5 - t + 9 * c + 4 * c * c) * A * A * A * A / 24));
  
  // Liten boks rundt punktet (50x50 meter)
  const bbox = `${utm_x-25},${utm_y-25},${utm_x+25},${utm_y+25}`;
  
  console.log(`Koordinater: ${lat}, ${lon} -> UTM32: ${utm_x.toFixed(2)}, ${utm_y.toFixed(2)}`);
  
  const url = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
  const params = new URLSearchParams({
    map: "GULLISTE",
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetFeatureInfo",
    BBOX: bbox,
    CRS: "EPSG:32632",
    WIDTH: "50",
    HEIGHT: "50",
    LAYERS: "Kulturmiljo",
    QUERY_LAYERS: "Kulturmiljo",
    STYLES: "",
    INFO_FORMAT: "text/plain",
    I: "25",
    J: "25",
    FEATURE_COUNT: "10"
  });

  try {
    const fullUrl = `${url}?${params.toString()}`;
    console.log("URL:", fullUrl);
    
    const response = await fetch(fullUrl);
    const text = await response.text();
    
    console.log("Response:", text.substring(0, 500));
    
    if (response.ok && !text.includes("ServiceException")) {
      if (text.includes("no results") || text.trim() === "") {
        return "Ikke i kulturmiljø / gul liste";
      } else {
        return "Del av kulturmiljø / gul liste";
      }
    } else {
      return "Feil ved oppslag";
    }
  } catch (error) {
    console.error("Feil:", error);
    return "Feil ved oppslag";
  }
}

// Test også med de andre lagene
async function testAlleLag() {
  console.log("=== TESTER ALLE LAG I GULLISTE ===\n");
  
  const lag = ["Kulturmiljo", "Sikringssone", "Lokaliteter", "Enkeltminner", 
               "Enkeltminner_o", "Enkeltminner_g", "Enkeltminner_r"];
  
  // Test på kjente historiske steder i Oslo
  const testSteder = [
    { lat: 59.9075, lon: 10.7460, navn: "Akershus festning" },
    { lat: 59.9170, lon: 10.7000, navn: "Frogner/Bygdøy" },
    { lat: 59.9139, lon: 10.7300, navn: "Kvadraturen" }
  ];
  
  for (const sted of testSteder) {
    console.log(`\n=== Tester ${sted.navn} ===`);
    
    for (const lagNavn of lag) {
      console.log(`\nPrøver lag: ${lagNavn}`);
      
      const utm_x = Math.round(263000 + (sted.lon - 10.75) * 111320 * Math.cos(sted.lat * Math.PI / 180));
      const utm_y = Math.round(6649000 + (sted.lat - 59.91) * 111320);
      const bbox = `${utm_x-100},${utm_y-100},${utm_x+100},${utm_y+100}`;
      
      const params = new URLSearchParams({
        map: "GULLISTE",
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetFeatureInfo",
        BBOX: bbox,
        CRS: "EPSG:32632",
        WIDTH: "200",
        HEIGHT: "200",
        LAYERS: lagNavn,
        QUERY_LAYERS: lagNavn,
        STYLES: "",
        INFO_FORMAT: "text/plain",
        I: "100",
        J: "100",
        FEATURE_COUNT: "50"
      });
      
      try {
        const response = await fetch(`https://od2.pbe.oslo.kommune.no/cgi-bin/wms?${params.toString()}`);
        const text = await response.text();
        
        if (response.ok && !text.includes("ServiceException") && !text.includes("not offered")) {
          if (text.trim() && !text.includes("no results")) {
            console.log("✅ TREFF! Response:", text.substring(0, 200));
          } else {
            console.log("- Ingen treff");
          }
        } else {
          console.log("❌ Lag ikke tilgjengelig for spørring");
        }
      } catch (error) {
        console.log("Feil:", error.message);
      }
    }
  }
}

// Kjør tester
async function main() {
  console.log("=== TEST AV ENKELADRESSE ===\n");
  const resultat = await sjekkKulturmiljo(59.9139, 10.7522);
  console.log(`\nResultat: ${resultat}`);
  
  console.log("\n\n");
  await testAlleLag();
}

main();