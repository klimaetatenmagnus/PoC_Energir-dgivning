async function sjekkGulListe(lat, lon) {
  // Konverter lat/lon til UTM32 (EPSG:32632) - grov tilnærming for Oslo
  // Dette er en forenklet konvertering som fungerer greit for Oslo-området
  const utm_x = Math.round(263000 + (lon - 10.75) * 111320 * Math.cos(lat * Math.PI / 180));
  const utm_y = Math.round(6649000 + (lat - 59.91) * 111320);
  
  // Liten boks rundt punktet (100x100 meter)
  const bbox = `${utm_x-50},${utm_y-50},${utm_x+50},${utm_y+50}`;
  
  const url = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
  const params = new URLSearchParams({
    map: "GULLISTE",
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetFeatureInfo",
    BBOX: bbox,
    CRS: "EPSG:32632",
    WIDTH: "100",
    HEIGHT: "100",
    LAYERS: "Gul liste",
    QUERY_LAYERS: "Gul liste",
    STYLES: "", // Legger til STYLES parameter
    INFO_FORMAT: "application/json", // Prøver JSON igjen
    I: "50",
    J: "50"
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`);
    const text = await response.text();
    
    console.log("API Response:", text);
    
    if (response.ok) {
      try {
        const data = JSON.parse(text);
        if (data.features && data.features.length > 0) {
          // Bygningen er på gul liste
          const feature = data.features[0];
          console.log("Feature funnet:", JSON.stringify(feature.properties, null, 2));
          return "Gul liste - bevaringsverdig bygning";
        } else {
          return "Ikke på gul liste";
        }
      } catch (parseError) {
        // Hvis ikke JSON, sjekk text format
        if (text.includes("GetFeatureInfo results:") && !text.includes("no results")) {
          return "Gul liste - bevaringsverdig bygning";
        } else {
          return "Ikke på gul liste";
        }
      }
    } else {
      return "Feil ved oppslag";
    }
  } catch (error) {
    console.error("Feil:", error);
    return "Feil ved oppslag";
  }
}

// Test funksjonen
async function test() {
  console.log("=== TESTER GUL LISTE API ===\n");
  
  // Testkoordinater i Oslo
  const testCases = [
    { lat: 59.9139, lon: 10.7522, beskrivelse: "Oslo sentrum" },
    { lat: 59.9110, lon: 10.7502, beskrivelse: "Slottet" },
    { lat: 59.9075, lon: 10.7460, beskrivelse: "Akershus festning" },
    { lat: 59.9170, lon: 10.7350, beskrivelse: "Frogner" },
    { lat: 59.9280, lon: 10.7150, beskrivelse: "Majorstuen" }
  ];

  for (const testCase of testCases) {
    console.log(`\nSjekker ${testCase.beskrivelse} (${testCase.lat}, ${testCase.lon})...`);
    const resultat = await sjekkGulListe(testCase.lat, testCase.lon);
    console.log(`Resultat: ${resultat}`);
  }
  
  // Test også GetCapabilities for å bekrefte
  console.log("\n\n=== BEKREFTER TILGJENGELIGE LAG ===");
  const capUrl = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms?map=GULLISTE&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities";
  
  try {
    const response = await fetch(capUrl);
    const text = await response.text();
    
    if (response.ok && text.includes("Gul liste")) {
      console.log("✅ 'Gul liste' laget er bekreftet tilgjengelig i GULLISTE kartet");
      
      // Finn støttede formater
      const formats = text.match(/<Format>([^<]+)<\/Format>/g) || [];
      console.log("\nStøttede INFO_FORMAT verdier:");
      formats.forEach(f => {
        const format = f.match(/<Format>([^<]+)<\/Format>/)?.[1];
        if (format) console.log(`- ${format}`);
      });
    }
  } catch (error) {
    console.error("Feil ved GetCapabilities:", error);
  }
}

test();