// Service for fetching and calculating solar energy data
import proj4 from 'proj4';

// Define EPSG:32632 (UTM zone 32N) projection
proj4.defs("EPSG:32632", "+proj=utm +zone=32 +datum=WGS84 +units=m +no_defs");

export interface SolarEnergyData {
  takAreal_m2?: number;
  sol_kwh_m2_yr?: number;
  sol_kwh_bygg_tot?: number;
  solKategori?: string;
  takflater?: Array<{
    tak_id: number;
    bygg_id: number | null;
    area_m2: number;
    irr_kwh_m2_yr: number;
    kWh_tot: number;
  }>;
  filteredSolarEnergy?: number;
}

export async function fetchSolarData(params: {
  byggId?: number;
  lat?: number;
  lon?: number;
  gnr?: number;
  bnr?: number;
  seksjonsnummer?: number;
  representasjonspunkt?: {
    east: number;
    north: number;
    epsg: string;
  };
}): Promise<SolarEnergyData | null> {
  try {
    console.log('☀️ fetchSolarData called with params:', params);
    
    let url = "http://localhost:4003/solinnstraling?";
    
    // Convert UTM coordinates to lat/lon if provided
    let lat = params.lat;
    let lon = params.lon;
    
    if (!lat && !lon && params.representasjonspunkt) {
      // Convert from UTM to WGS84
      const wgs84Coords = proj4("EPSG:32632", "EPSG:4326", [
        params.representasjonspunkt.east,
        params.representasjonspunkt.north
      ]);
      lon = wgs84Coords[0];
      lat = wgs84Coords[1];
      
      console.log('📍 Converted coordinates for solar lookup:', {
        utm: { east: params.representasjonspunkt.east, north: params.representasjonspunkt.north },
        wgs84: { lat, lon }
      });
    }
    
    // Prioritize coordinates over building ID
    if (lat && lon) {
      url += `lat=${lat}&lon=${lon}`;
      console.log(`☀️ Fetching solar data for coordinates: ${lat}, ${lon}`);
    } else if (params.byggId) {
      url += `bygg_id=${params.byggId}`;
      console.log(`☀️ Fetching solar data for bygg_id=${params.byggId}`);
    } else if (params.gnr && params.bnr) {
      url += `gnr=${params.gnr}&bnr=${params.bnr}`;
      if (params.seksjonsnummer) {
        url += `&snr=${params.seksjonsnummer}`;
      }
      console.log(`☀️ Fetching solar data for gnr=${params.gnr}, bnr=${params.bnr}${params.seksjonsnummer ? `, snr=${params.seksjonsnummer}` : ''}`);
    } else {
      console.log("⚠️ No parameters for solar lookup");
      return null;
    }
    
    console.log(`☀️ Full URL: ${url}`);
    const response = await fetch(url);
    console.log(`☀️ Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`⚠️ Solar service error response: ${errorText}`);
      if (response.status === 404) {
        console.log("⚠️ No solar data found (404)");
        return null;
      }
      throw new Error(`Solar service error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`☀️ Solar data received:`, data);
    
    if (data.error) {
      console.log(`⚠️ Solar service returned error: ${data.error}`);
      return null;
    }
    
    // Calculate filtered solar energy (only roof surfaces with radiation > 800 kWh/m²)
    let filteredSolarEnergy = 0;
    const minRadiation = 800; // kWh/m²
    const solarPanelEfficiency = 0.2; // 20% efficiency
    
    if (data.takflater && Array.isArray(data.takflater)) {
      filteredSolarEnergy = data.takflater
        .filter((tak: any) => tak.irr_kwh_m2_yr > minRadiation)
        .reduce((sum: number, tak: any) => sum + (tak.irr_kwh_m2_yr * tak.area_m2 * solarPanelEfficiency), 0);
      
      console.log(`☀️ Filtered solar energy calculation:`, {
        totalSurfaces: data.takflater.length,
        filteredSurfaces: data.takflater.filter((tak: any) => tak.irr_kwh_m2_yr > minRadiation).length,
        filteredSolarEnergy: Math.round(filteredSolarEnergy)
      });
    }
    
    return {
      takAreal_m2: data.takAreal_m2,
      sol_kwh_m2_yr: data.sol_kwh_m2_yr,
      sol_kwh_bygg_tot: data.sol_kwh_bygg_tot,
      solKategori: data.category,
      takflater: data.takflater,
      filteredSolarEnergy: Math.round(filteredSolarEnergy)
    };
  } catch (error) {
    console.log(`❌ Error fetching solar data: ${error}`);
    return null;
  }
}