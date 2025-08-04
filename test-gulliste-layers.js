async function analyzeGulListeLayers() {
  console.log("=== ANALYSERER GULLISTE WMS CAPABILITIES ===\n");
  
  const url = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms?map=GULLISTE&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities";
  
  try {
    const response = await fetch(url);
    const xml = await response.text();
    
    if (!response.ok || !xml.includes("WMS_Capabilities")) {
      console.log("Kunne ikke hente capabilities");
      return;
    }
    
    // Parse XML for å finne queryable layers
    const layers = [];
    const layerMatches = xml.match(/<Layer[\s\S]*?<\/Layer>/g) || [];
    
    layerMatches.forEach(layerXml => {
      const nameMatch = layerXml.match(/<Name>([^<]+)<\/Name>/);
      const titleMatch = layerXml.match(/<Title>([^<]+)<\/Title>/);
      const queryableMatch = layerXml.match(/queryable="(\d)"/);
      
      if (nameMatch && nameMatch[1] !== 'WMS') {
        layers.push({
          name: nameMatch[1],
          title: titleMatch ? titleMatch[1] : '',
          queryable: queryableMatch ? queryableMatch[1] === '1' : false
        });
      }
    });
    
    console.log("ALLE LAG I GULLISTE:");
    layers.forEach(layer => {
      console.log(`\nNavn: ${layer.name}`);
      console.log(`Tittel: ${layer.title}`);
      console.log(`Queryable: ${layer.queryable ? '✅ JA' : '❌ NEI'}`);
    });
    
    // Test GetFeatureInfo på queryable layers
    const queryableLayers = layers.filter(l => l.queryable);
    
    if (queryableLayers.length > 0) {
      console.log("\n\n=== TESTER GETFEATUREINFO PÅ QUERYABLE LAG ===");
      
      for (const layer of queryableLayers) {
        console.log(`\nTester lag: ${layer.name}`);
        
        // Test koordinater midt i Oslo
        const utm_x = 598000;
        const utm_y = 6643000;
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
          LAYERS: layer.name,
          QUERY_LAYERS: layer.name,
          STYLES: "",
          INFO_FORMAT: "text/plain",
          I: "100",
          J: "100",
          FEATURE_COUNT: "10"
        });
        
        try {
          const featureResponse = await fetch(`https://od2.pbe.oslo.kommune.no/cgi-bin/wms?${params.toString()}`);
          const featureText = await featureResponse.text();
          
          console.log("Response status:", featureResponse.status);
          console.log("Response preview:", featureText.substring(0, 200));
          
          if (featureResponse.ok && !featureText.includes("ServiceException")) {
            console.log("✅ GetFeatureInfo fungerer for dette laget!");
          }
        } catch (error) {
          console.log("Feil ved test:", error.message);
        }
      }
    }
    
  } catch (error) {
    console.error("Feil:", error);
  }
}

analyzeGulListeLayers();