// Analyser Oslo kommune sitt kart for å finne API-er
async function discoverOsloAPIs() {
    console.log("Analyserer Oslo kommune sine kartløsninger...\n");
    
    // Test kjente Oslo kommune endepunkter
    const endpoints = [
        // Plan- og bygningsetaten
        { url: "https://od2.pbe.oslo.kommune.no/kart/assets/index-e488bf5f.js", type: "JavaScript bundle" },
        { url: "https://kart.pbe.oslo.kommune.no/", type: "PBE Kart" },
        
        // Oslo kommune geodata
        { url: "https://geodata.oslo.kommune.no/", type: "Geodata portal" },
        { url: "https://kartkatalog.geonorge.no/metadata/oslo-kommune/", type: "Geonorge katalog" },
        
        // Byantikvarens kart (for gul liste)
        { url: "https://kart.ra.no/", type: "Riksantikvaren" },
        { url: "https://www.oslo.kommune.no/byantikvaren/", type: "Byantikvaren" }
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\n=== ${endpoint.type} ===`);
        console.log(`URL: ${endpoint.url}`);
        
        try {
            const response = await fetch(endpoint.url);
            console.log(`Status: ${response.status}`);
            
            if (response.ok && endpoint.url.includes('.js')) {
                // Analyser JavaScript for API-er
                const js = await response.text();
                
                // Søk etter API URLs
                const apiPatterns = [
                    /https?:\/\/[^"'\s]+\/api[^"'\s]*/g,
                    /https?:\/\/[^"'\s]+\/wms[^"'\s]*/g,
                    /https?:\/\/[^"'\s]+\/wfs[^"'\s]*/g,
                    /https?:\/\/[^"'\s]+\/rest\/services[^"'\s]*/g,
                    /https?:\/\/[^"'\s]+\/geoserver[^"'\s]*/g,
                    /https?:\/\/[^"'\s]+arcgis[^"'\s]*/g
                ];
                
                const foundAPIs = new Set();
                
                for (const pattern of apiPatterns) {
                    const matches = js.match(pattern) || [];
                    matches.forEach(match => foundAPIs.add(match));
                }
                
                if (foundAPIs.size > 0) {
                    console.log("\nFunnet API-er:");
                    [...foundAPIs].slice(0, 10).forEach(api => {
                        console.log(`- ${api}`);
                    });
                }
                
                // Sjekk for spesifikke Oslo/kulturminne relaterte strenger
                if (js.includes('kulturminn') || js.includes('gul') || js.includes('bevar')) {
                    console.log("\n✅ Fant kulturminne-relatert kode!");
                }
            }
        } catch (error) {
            console.log(`Feil: ${error.message}`);
        }
    }
    
    // Test direkte mot kjente norske WMS-tjenester
    console.log("\n\n=== TESTER NORSKE WMS-TJENESTER ===");
    
    const norwegianWMS = [
        "https://wms.geonorge.no/skwms1/wms.kulturminner",
        "https://wms.geonorge.no/skwms1/wms.nrl",
        "https://openwms.statkart.no/skwms1/wms.byggesaksbehandling"
    ];
    
    for (const wms of norwegianWMS) {
        console.log(`\nTester: ${wms}`);
        try {
            const response = await fetch(`${wms}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`);
            if (response.ok) {
                const text = await response.text();
                if (text.includes("WMS_Capabilities")) {
                    console.log("✅ WMS fungerer!");
                    
                    // Søk etter relevante lag
                    const layers = text.match(/<Name>([^<]+)<\/Name>/g) || [];
                    const relevant = layers.filter(l => 
                        l.toLowerCase().includes('gul') || 
                        l.toLowerCase().includes('list') ||
                        l.toLowerCase().includes('vern')
                    );
                    
                    if (relevant.length > 0) {
                        console.log("Relevante lag:");
                        relevant.forEach(l => console.log(`- ${l}`));
                    }
                }
            }
        } catch (error) {
            console.log(`Feil: ${error.message}`);
        }
    }
}

// Kjør discovery
discoverOsloAPIs();