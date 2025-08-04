async function testWFSEiendom() {
  console.log("=== TESTER WFS EIENDOM API ===\n");
  
  const baseUrl = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
  
  // Test med eksempel teigid fra URL-en
  const testTeigid = "291199441";
  
  // Test forskjellige map/tabell kombinasjoner
  const testCases = [
    {
      map: "EIENDOM_TABELL",
      tabell: "regis.vpor_planprogram",
      type: "planprogram",
      beskrivelse: "Planprogram (fra eksempel)"
    },
    {
      map: "EIENDOM_TABELL",
      tabell: "regis.vpor_gulliste",
      type: "gulliste",
      beskrivelse: "Gul liste (gjetning)"
    },
    {
      map: "EIENDOM_TABELL", 
      tabell: "regis.vpor_kulturminne",
      type: "kulturminne",
      beskrivelse: "Kulturminne (gjetning)"
    },
    {
      map: "EIENDOM_TABELL",
      tabell: "regis.vpor_bevaringsverdig",
      type: "bevaringsverdig",
      beskrivelse: "Bevaringsverdig (gjetning)"
    }
  ];
  
  for (const test of testCases) {
    console.log(`\n--- ${test.beskrivelse} ---`);
    
    const params = new URLSearchParams({
      map: test.map,
      tabell: test.tabell,
      type: test.type,
      service: "WFS",
      version: "1.1.0",
      request: "GetFeature",
      typeName: "eiendom_polygon,eiendom_linje",
      teigid: testTeigid
    });
    
    const url = `${baseUrl}?${params.toString()}`;
    console.log(`URL: ${url}\n`);
    
    try {
      const response = await fetch(url);
      const text = await response.text();
      
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        // Sjekk om det er XML/GML
        if (text.includes("<?xml") || text.includes("<wfs:FeatureCollection")) {
          console.log("✅ WFS respons mottatt");
          
          // Se etter features
          const featureCount = (text.match(/<gml:featureMember>/g) || []).length;
          console.log(`Antall features: ${featureCount}`);
          
          // Vis et utdrag
          const preview = text.substring(0, 500).replace(/\s+/g, ' ');
          console.log(`Preview: ${preview}...`);
          
        } else if (text.includes("ServiceException")) {
          const error = text.match(/<ServiceException[^>]*>([^<]+)<\/ServiceException>/)?.[1];
          console.log(`❌ Service exception: ${error}`);
        } else {
          console.log("Response:", text.substring(0, 200));
        }
      }
    } catch (error) {
      console.log(`Feil: ${error.message}`);
    }
  }
  
  // Test også GetCapabilities for å se hvilke tabeller som finnes
  console.log("\n\n=== SJEKKER WFS CAPABILITIES ===");
  
  const capParams = new URLSearchParams({
    map: "EIENDOM_TABELL",
    service: "WFS",
    version: "1.1.0",
    request: "GetCapabilities"
  });
  
  try {
    const response = await fetch(`${baseUrl}?${capParams.toString()}`);
    const text = await response.text();
    
    if (response.ok && text.includes("WFS_Capabilities")) {
      console.log("✅ WFS Capabilities hentet");
      
      // Finn alle FeatureTypes
      const featureTypes = text.match(/<FeatureType>[\s\S]*?<\/FeatureType>/g) || [];
      console.log(`\nAntall FeatureTypes: ${featureTypes.length}`);
      
      // Se etter kulturminne-relaterte
      featureTypes.forEach(ft => {
        const name = ft.match(/<Name>([^<]+)<\/Name>/)?.[1];
        const title = ft.match(/<Title>([^<]+)<\/Title>/)?.[1];
        
        if (name && (
          name.toLowerCase().includes('gul') ||
          name.toLowerCase().includes('kultur') ||
          name.toLowerCase().includes('bevar') ||
          name.toLowerCase().includes('vern') ||
          title?.toLowerCase().includes('gul') ||
          title?.toLowerCase().includes('kultur')
        )) {
          console.log(`\nRelevant FeatureType funnet:`);
          console.log(`Name: ${name}`);
          console.log(`Title: ${title || 'N/A'}`);
        }
      });
    }
  } catch (error) {
    console.log(`Feil ved GetCapabilities: ${error.message}`);
  }
  
  // Test også direkte spørring uten teigid
  console.log("\n\n=== TEST DIREKTE SPØRRING MED BBOX ===");
  
  // Oslo sentrum i UTM32
  const bbox = "597900,6643000,598100,6643200";
  
  const bboxParams = new URLSearchParams({
    map: "EIENDOM_TABELL",
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typeName: "eiendom_polygon",
    bbox: bbox,
    srsName: "EPSG:32632",
    outputFormat: "GML2"
  });
  
  try {
    const response = await fetch(`${baseUrl}?${bboxParams.toString()}`);
    const text = await response.text();
    
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      const featureCount = (text.match(/<gml:featureMember>/g) || []).length;
      console.log(`Features i området: ${featureCount}`);
    }
  } catch (error) {
    console.log(`Feil: ${error.message}`);
  }
}

testWFSEiendom();