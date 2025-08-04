async function testAutocompleteAPI() {
  console.log("=== TESTER AUTOCOMPLETE API ===\n");
  
  const baseUrl = "https://od2.pbe.oslo.kommune.no/noden/getAutocompleteData";
  
  // Test forskjellige måter å kalle API-et på
  const testCases = [
    // Uten parametere
    { params: {}, beskrivelse: "Uten parametere" },
    
    // Med søkeord
    { params: { q: "gul" }, beskrivelse: "Søk: 'gul'" },
    { params: { query: "gul" }, beskrivelse: "Søk: 'gul' (query)" },
    { params: { search: "gul" }, beskrivelse: "Søk: 'gul' (search)" },
    { params: { term: "gul" }, beskrivelse: "Søk: 'gul' (term)" },
    
    // Søk på adresser
    { params: { q: "karl johans gate" }, beskrivelse: "Søk: 'karl johans gate'" },
    { params: { q: "slottet" }, beskrivelse: "Søk: 'slottet'" },
    
    // Søk relatert til kulturminner
    { params: { q: "bevaringsverdig" }, beskrivelse: "Søk: 'bevaringsverdig'" },
    { params: { q: "kulturminne" }, beskrivelse: "Søk: 'kulturminne'" },
    { params: { q: "verneverdig" }, beskrivelse: "Søk: 'verneverdig'" },
    
    // Med koordinater
    { params: { lat: 59.9139, lon: 10.7522 }, beskrivelse: "Med koordinater" },
    { params: { x: 597980, y: 6643120 }, beskrivelse: "Med UTM koordinater" },
    
    // Kombinasjoner
    { params: { q: "gul", type: "kulturminne" }, beskrivelse: "Søk med type" },
    { params: { q: "oslo", layer: "gulliste" }, beskrivelse: "Søk med layer" }
  ];
  
  for (const test of testCases) {
    console.log(`\n--- ${test.beskrivelse} ---`);
    
    try {
      // Test både GET og POST
      for (const method of ['GET', 'POST']) {
        console.log(`${method} request:`);
        
        let response;
        if (method === 'GET') {
          const params = new URLSearchParams(test.params);
          const url = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
          response = await fetch(url);
        } else {
          response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(test.params)
          });
        }
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          const text = await response.text();
          
          console.log(`Content-Type: ${contentType}`);
          
          if (contentType?.includes('application/json')) {
            try {
              const data = JSON.parse(text);
              console.log("✅ JSON Response:", JSON.stringify(data, null, 2).substring(0, 500));
              
              // Hvis vi får data, analyser strukturen
              if (Array.isArray(data) && data.length > 0) {
                console.log("\nFørste resultat struktur:");
                console.log(Object.keys(data[0]));
              }
            } catch (e) {
              console.log("JSON parse error:", e.message);
            }
          } else {
            console.log("Response preview:", text.substring(0, 200));
          }
          
          // Hvis vi får svar, ikke test POST
          if (method === 'GET' && response.ok) break;
        }
      }
    } catch (error) {
      console.log("Feil:", error.message);
    }
  }
  
  // Test også andre mulige endepunkter
  console.log("\n\n=== TESTER ANDRE MULIGE ENDEPUNKTER ===");
  
  const andreEndepunkter = [
    "/noden/getData",
    "/noden/search",
    "/noden/query",
    "/noden/getFeatureInfo",
    "/noden/getGulListe",
    "/api/gulliste",
    "/api/kulturminner",
    "/services/query"
  ];
  
  for (const endpoint of andreEndepunkter) {
    const url = `https://od2.pbe.oslo.kommune.no${endpoint}`;
    console.log(`\nTester: ${url}`);
    
    try {
      const response = await fetch(url);
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        console.log("✅ Endepunkt eksisterer!");
      }
    } catch (error) {
      console.log("Feil:", error.message);
    }
  }
}

testAutocompleteAPI();