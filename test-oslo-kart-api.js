// Test for å sjekke Oslo kommune sitt kart
async function analyserOsloKart() {
  console.log('Analyserer Oslo kommune sitt kart...\n');
  
  // Først hent HTML-siden
  try {
    const response = await fetch('https://od2.pbe.oslo.kommune.no/kart/');
    const html = await response.text();
    
    // Søk etter JavaScript filer og API endepunkter
    const scriptMatches = html.match(/<script[^>]*src="([^"]+)"/g) || [];
    const apiMatches = html.match(/https?:\/\/[^"'\s]+api[^"'\s]*/gi) || [];
    const serviceMatches = html.match(/https?:\/\/[^"'\s]+service[^"'\s]*/gi) || [];
    const geoserverMatches = html.match(/https?:\/\/[^"'\s]+geoserver[^"'\s]*/gi) || [];
    const wmsMatches = html.match(/https?:\/\/[^"'\s]+wms[^"'\s]*/gi) || [];
    
    console.log('=== SCRIPT FILER ===');
    scriptMatches.forEach(match => {
      const src = match.match(/src="([^"]+)"/)?.[1];
      if (src) console.log(src);
    });
    
    console.log('\n=== MULIGE API ENDEPUNKTER ===');
    const allEndpoints = [...new Set([...apiMatches, ...serviceMatches, ...geoserverMatches, ...wmsMatches])];
    allEndpoints.forEach(endpoint => console.log(endpoint));
    
    // Sjekk for OpenLayers eller andre kartbiblioteker
    const hasOpenLayers = html.includes('OpenLayers') || html.includes('ol.');
    const hasLeaflet = html.includes('Leaflet') || html.includes('L.map');
    const hasMapbox = html.includes('mapbox');
    
    console.log('\n=== KARTBIBLIOTEKER ===');
    if (hasOpenLayers) console.log('- OpenLayers funnet');
    if (hasLeaflet) console.log('- Leaflet funnet');
    if (hasMapbox) console.log('- Mapbox funnet');
    
  } catch (error) {
    console.error('Feil ved henting av siden:', error);
  }
}

// Kjør analyse
analyserOsloKart();