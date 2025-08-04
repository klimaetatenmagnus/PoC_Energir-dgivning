async function sjekkVernestatus(lat, lon, debug = false) {
  const url = `https://kart.ra.no/arcgis/rest/services/Distribusjon/Kulturminner/MapServer/identify?geometry=${lon},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=all&tolerance=5&returnGeometry=false&mapExtent=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}&imageDisplay=1000,1000,96&f=json`;

  const res = await fetch(url);
  const data = await res.json();

  if (debug) {
    console.log('Full API response:', JSON.stringify(data, null, 2));
    console.log('Results array:', data.results);
    console.log('Number of results:', data.results?.length || 0);
  }

  const vern = data.results?.[0]?.attributes?.høyesteVern;
  if (vern === 'kommunalt listeført') {
    return "Gul liste";
  } else if (vern) {
    return `Annen vernestatus: ${vern}`;
  } else {
    return "Ikke listeført";
  }
}

// Test funksjonen med eksempel koordinater
async function test() {
  console.log('Tester vernestatus API...\n');
  
  // Test med Oslo sentrum koordinater
  const testCases = [
    { lat: 59.9139, lon: 10.7522, beskrivelse: "Oslo sentrum" },
    { lat: 59.9110, lon: 10.7502, beskrivelse: "Slottet" },
    { lat: 59.9075, lon: 10.7460, beskrivelse: "Akershus festning" }
  ];

  // Først test med debug på for å se hva API-et returnerer
  console.log('=== DEBUG TEST - Oslo sentrum ===');
  try {
    const debugResultat = await sjekkVernestatus(59.9139, 10.7522, true);
    console.log(`Debug resultat: ${debugResultat}\n`);
  } catch (error) {
    console.error('Feil ved debug test:', error);
  }

  // Kjør vanlige tester
  console.log('=== NORMALE TESTER ===');
  for (const testCase of testCases) {
    try {
      console.log(`Sjekker ${testCase.beskrivelse} (${testCase.lat}, ${testCase.lon})...`);
      const resultat = await sjekkVernestatus(testCase.lat, testCase.lon);
      console.log(`Resultat: ${resultat}\n`);
    } catch (error) {
      console.error(`Feil ved sjekk av ${testCase.beskrivelse}:`, error);
    }
  }
}

// Kjør test
test();