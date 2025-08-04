async function testOsloWMS() {
    console.log("Tester Oslo kommune WMS med map-parameter...\n");
    
    // Fra JavaScript-filen fant vi at de bruker map= parameter
    // La oss teste med GetCapabilities først for å finne riktige lag
    
    const baseUrl = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
    
    // Liste over mulige map-navn relatert til kulturminner/bevaringsverdige bygg
    const mapNames = [
        "KULTURMINNER",
        "BEVARINGSOMRADER", 
        "BEVARINGSVERDIGE",
        "GULLISTE",
        "VERNEVERDIG",
        "FREDEDE",
        "REGULERING",
        "REGTILLEGG"
    ];
    
    console.log("=== SØKER ETTER KULTURMINNE-RELATERTE KART ===");
    
    for (const mapName of mapNames) {
        console.log(`\nTester map=${mapName}`);
        
        try {
            // Test GetCapabilities
            const capUrl = `${baseUrl}?map=${mapName}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;
            const response = await fetch(capUrl);
            
            if (response.ok) {
                const text = await response.text();
                
                if (text.includes("WMS_Capabilities") || text.includes("<Layer")) {
                    console.log("✅ Gyldig WMS kart funnet!");
                    
                    // Finn alle lag
                    const layers = text.match(/<Name>([^<]+)<\/Name>/g) || [];
                    console.log(`Antall lag: ${layers.length}`);
                    
                    if (layers.length > 0) {
                        console.log("Lag i dette kartet:");
                        layers.forEach(layer => {
                            const name = layer.match(/<Name>([^<]+)<\/Name>/)?.[1];
                            if (name) console.log(`  - ${name}`);
                        });
                        
                        // Test GetFeatureInfo på første lag
                        const firstLayer = layers[0].match(/<Name>([^<]+)<\/Name>/)?.[1];
                        if (firstLayer) {
                            await testGetFeatureInfo(mapName, firstLayer);
                        }
                    }
                }
            }
        } catch (error) {
            // Ignorer feil, prøv neste
        }
    }
    
    // Test også direkte med kartfiler vi fant i JavaScript
    console.log("\n\n=== TESTER SPESIFIKKE KARTFILER FRA JAVASCRIPT ===");
    
    const specificMaps = [
        { map: "VANN", layer: "Vann" },
        { map: "FJERNVARME", layer: "Fjernvarme" },
        { map: "AADT", layer: "AADT_fastskala" },
        { map: "REGTILLEGG", layer: "Omraadeplan" },
        { map: "BLAGRONNFAKTOR", layer: "blagronn_faktor" }
    ];
    
    for (const config of specificMaps) {
        console.log(`\nTester map=${config.map}, layer=${config.layer}`);
        
        try {
            const url = `${baseUrl}?map=${config.map}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;
            const response = await fetch(url);
            
            if (response.ok) {
                const text = await response.text();
                console.log(`Status: ${response.status} - ${text.includes("WMS_Capabilities") ? "✅ Gyldig WMS" : "❌ Ikke WMS"}`);
                
                // Sjekk om det finnes kulturminne-relaterte lag
                if (text.toLowerCase().includes("kultur") || 
                    text.toLowerCase().includes("bevar") || 
                    text.toLowerCase().includes("vern") ||
                    text.toLowerCase().includes("gul")) {
                    console.log("⭐ Mulig kulturminne-relatert innhold!");
                }
            }
        } catch (error) {
            console.log(`Feil: ${error.message}`);
        }
    }
}

async function testGetFeatureInfo(mapName, layerName) {
    console.log(`\n  Testing GetFeatureInfo for ${layerName}...`);
    
    const baseUrl = "https://od2.pbe.oslo.kommune.no/cgi-bin/wms";
    const bbox = "596000,6642600,597000,6642700"; // Oslo sentrum i UTM32
    
    const params = new URLSearchParams({
        map: mapName,
        SERVICE: "WMS",
        VERSION: "1.3.0",
        REQUEST: "GetFeatureInfo",
        BBOX: bbox,
        CRS: "EPSG:32632",
        WIDTH: "1000",
        HEIGHT: "1000",
        LAYERS: layerName,
        QUERY_LAYERS: layerName,
        INFO_FORMAT: "application/json",
        I: "500",
        J: "500"
    });
    
    try {
        const response = await fetch(`${baseUrl}?${params.toString()}`);
        const text = await response.text();
        
        if (response.ok) {
            try {
                const data = JSON.parse(text);
                console.log(`  ✅ GetFeatureInfo fungerer! Antall features: ${data.features?.length || 0}`);
            } catch {
                console.log(`  ⚠️  GetFeatureInfo svarte, men ikke JSON`);
            }
        }
    } catch (error) {
        console.log(`  ❌ Feil: ${error.message}`);
    }
}

// Kjør test
testOsloWMS();