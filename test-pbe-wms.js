async function testPbeWmsGetFeatureInfo() {
    // Testkoordinater og BBOX i EPSG:32632 (UTM-sone 32N, Oslo-området)
    const bbox = "596000,6642600,597000,6642700"; // liten kartutsnitt i meter
    const width = 1000;
    const height = 1000;
    const i = 500; // midt i bildet (klikkpunkt)
    const j = 500;

    // Lag som vi antar finnes (du kan bytte til eksakt navn når kjent)
    const layer = "kulturminner_gul_liste"; // endre dette hvis laget har annet navn

    // Prøv forskjellige WMS endepunkter
    const urls = [
        "https://od2.pbe.oslo.kommune.no/cgi-bin/mapserv?map=/ms/maps/od2_wms.map",
        "https://od2.pbe.oslo.kommune.no/geoserver/wms",
        "https://od2.pbe.oslo.kommune.no/wms",
        "https://wms.geonorge.no/skwms1/wms.byggesaksbehandling"
    ];
    
    for (const baseUrl of urls) {
        console.log(`\n--- Tester: ${baseUrl} ---`);
        
        const params = new URLSearchParams({
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetFeatureInfo",
            "BBOX": bbox,
            "CRS": "EPSG:32632",
            "WIDTH": width,
            "HEIGHT": height,
            "LAYERS": layer,
            "QUERY_LAYERS": layer,
            "INFO_FORMAT": "application/json",
            "I": i,
            "J": j
        });

        const fullUrl = `${baseUrl}?${params.toString()}`;

        try {
            const response = await fetch(fullUrl, { 
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log(`Status: ${response.status} ${response.statusText}`);
            
            const text = await response.text();
            
            if (response.ok) {
                console.log("✅ WMS GetFeatureInfo API svarte!");
                
                try {
                    const data = JSON.parse(text);
                    console.log("🔎 Antall treff i kartlaget:", data.features?.length || 0);
                    if (data.features && data.features.length > 0) {
                        console.log("\nFørste treff:", JSON.stringify(data.features[0], null, 2));
                    }
                    break; // Stopp hvis vi finner et fungerende endepunkt
                } catch (jsonError) {
                    console.log("⚠️  API svarte, men ikke med gyldig JSON:");
                    console.log(text.substring(0, 200));
                }
            } else {
                console.log("❌ API returnerte feil:", response.status);
            }
            
        } catch (error) {
            console.log("❌ Nettverksfeil:", error.message);
        }
    }
}

// Test også GetCapabilities for å se hvilke lag som finnes
async function testGetCapabilities() {
    console.log("\n=== TESTER GETCAPABILITIES ===");
    
    const urls = [
        "https://od2.pbe.oslo.kommune.no/cgi-bin/mapserv?map=/ms/maps/od2_wms.map",
        "https://wms.geonorge.no/skwms1/wms.byggesaksbehandling",
        "https://kart.pbe.oslo.kommune.no/geoserver/pbe/wms"
    ];
    
    for (const url of urls) {
        console.log(`\nPrøver: ${url}`);
        const params = new URLSearchParams({
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetCapabilities"
        });
    
        try {
            const response = await fetch(`${url}?${params.toString()}`);
            const text = await response.text();
            
            if (response.ok && text.includes("<WMS_Capabilities")) {
                console.log("✅ GetCapabilities fungerer!");
                
                // Søk etter alle lag
                const allLayers = text.match(/<Layer[^>]*>[\s\S]*?<Name>([^<]+)<\/Name>/g) || [];
                
                console.log(`Fant ${allLayers.length} lag totalt`);
                
                // Søk spesifikt etter kulturminner/gul liste
                const relevantLayers = allLayers.filter(layer => {
                    const name = layer.match(/<Name>([^<]+)<\/Name>/)?.[1]?.toLowerCase() || "";
                    return name.includes('kulturminn') || 
                           name.includes('gul') || 
                           name.includes('list') ||
                           name.includes('vern') ||
                           name.includes('bevar');
                });
                
                if (relevantLayers.length > 0) {
                    console.log("\nRelevante lag funnet:");
                    relevantLayers.forEach(layer => {
                        const name = layer.match(/<Name>([^<]+)<\/Name>/)?.[1];
                        console.log(`- ${name}`);
                    });
                } else if (allLayers.length > 0) {
                    console.log("\nViser første 10 lag:");
                    allLayers.slice(0, 10).forEach(layer => {
                        const name = layer.match(/<Name>([^<]+)<\/Name>/)?.[1];
                        console.log(`- ${name}`);
                    });
                }
                
                break; // Stopp hvis vi finner fungerende endepunkt
            } else {
                console.log("❌ Ikke gyldig WMS respons");
            }
        } catch (error) {
            console.log("❌ Feil:", error.message);
        }
    }
}

// Kjør testene
async function runTests() {
    await testPbeWmsGetFeatureInfo();
    await testGetCapabilities();
}

runTests();