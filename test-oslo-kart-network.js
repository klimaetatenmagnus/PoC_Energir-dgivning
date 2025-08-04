// Analyser Oslo kommune sitt kart for API-er
import puppeteer from 'puppeteer';

async function captureNetworkTraffic() {
  console.log('Starter Puppeteer for å analysere nettverkstrafikk...\n');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const requests = [];
  
  // Lytt til alle nettverksforespørsler
  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('service') || url.includes('wms') || 
        url.includes('wfs') || url.includes('geoserver') || url.includes('tile') ||
        url.includes('arcgis') || url.includes('mapserver')) {
      requests.push({
        url: url,
        method: request.method(),
        resourceType: request.resourceType()
      });
    }
  });
  
  try {
    await page.goto('https://od2.pbe.oslo.kommune.no/kart/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Vent litt ekstra for at kartet skal laste
    await page.waitForTimeout(5000);
    
    console.log('=== API/SERVICE FORESPØRSLER ===');
    requests.forEach(req => {
      console.log(`${req.method} ${req.resourceType}: ${req.url}`);
    });
    
    // Sjekk også for globale objekter i nettleseren
    const libraries = await page.evaluate(() => {
      const libs = [];
      if (typeof ol !== 'undefined') libs.push('OpenLayers');
      if (typeof L !== 'undefined') libs.push('Leaflet');
      if (typeof mapboxgl !== 'undefined') libs.push('Mapbox GL');
      if (typeof esri !== 'undefined') libs.push('ESRI/ArcGIS');
      return libs;
    });
    
    console.log('\n=== KARTBIBLIOTEKER FUNNET ===');
    libraries.forEach(lib => console.log(`- ${lib}`));
    
  } catch (error) {
    console.error('Feil:', error);
  } finally {
    await browser.close();
  }
}

// Prøv å kjøre puppeteer eller fallback til enkel analyse
try {
  await captureNetworkTraffic();
} catch(e) {
  console.log('Puppeteer er ikke installert eller feilet.');
  console.log('\nPrøver alternativ metode...\n');
  
  // Alternativ: Analyser JavaScript filen direkte
  async function analyzeJsFile() {
    try {
      const res = await fetch('https://od2.pbe.oslo.kommune.no/kart/assets/index-e488bf5f.js');
      const js = await res.text();
      
      // Søk etter kjente mønstre
      console.log('=== ANALYSE AV JAVASCRIPT ===');
      
      if (js.includes('OpenLayers') || js.includes('ol.')) {
        console.log('- OpenLayers detektert');
      }
      if (js.includes('leaflet') || js.includes('L.map')) {
        console.log('- Leaflet detektert');
      }
      
      // Søk etter URL-er
      const urlMatches = js.match(/https?:\/\/[^"'\s]+/g) || [];
      const apiUrls = urlMatches.filter(url => 
        url.includes('api') || url.includes('service') || 
        url.includes('wms') || url.includes('geoserver') ||
        url.includes('arcgis')
      );
      
      console.log('\n=== MULIGE API-ER I KODEN ===');
      [...new Set(apiUrls)].slice(0, 10).forEach(url => console.log(url));
      
    } catch (error) {
      console.error('Feil ved analyse:', error);
    }
  }
  
  await analyzeJsFile();
}