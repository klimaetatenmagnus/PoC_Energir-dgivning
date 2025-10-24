// Service for fetching and calculating solar energy data
import proj4 from 'proj4';
import { getAppConfig } from '../runtimeConfig.ts';

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
  id?: number;
  center_x?: number;
  center_y?: number;
  usable_roof_area_m2?: number;
  total_irr_yr_kwh?: number;
  avg_irr_m2_yr_kwh?: number;
  category?: string;
  roof_complexity?: string;
  estimated_panels?: number;
  estimated_capacity_kw?: number;
  annual_production_kwh?: number;
  co2_savings_kg?: number;
  payback_years?: number;
  subsidy_available?: boolean;
  subsidy_amount?: number;
  installation_cost_estimate?: number;
  annual_savings_nok?: number;
  share_percentage?: number;
  heritage_status?: string;
  heritage_description?: string;
  roof_orientations?: Array<{
    direction: string;
    percentage: number;
    suitability: string;
  }>;
}

type SolarRoofSurface = {
  tak_id: number;
  bygg_id: number | null;
  area_m2: number;
  irr_kwh_m2_yr: number;
  kWh_tot: number;
};

type SolarServiceResponse = {
  takAreal_m2?: number;
  sol_kwh_m2_yr?: number;
  sol_kwh_bygg_tot?: number;
  category?: string;
  takflater?: SolarRoofSurface[];
  error?: unknown;
};

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
    // console.log('☀️ fetchSolarData called with params:', params);
    
    const { solarProxyBaseUrl } = getAppConfig();
    const baseUrl = solarProxyBaseUrl.replace(/\/$/, '');
    const searchParams = new URLSearchParams();
    
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
      
      // console.log('📍 Converted coordinates for solar lookup:', {
      //   utm: { east: params.representasjonspunkt.east, north: params.representasjonspunkt.north },
      //   wgs84: { lat, lon }
      // });
    }
    
    // Prioritize coordinates over building ID
    if (lat && lon) {
      searchParams.set('lat', String(lat));
      searchParams.set('lon', String(lon));
      // console.log(`☀️ Fetching solar data for coordinates: ${lat}, ${lon}`);
    } else if (params.byggId) {
      searchParams.set('bygg_id', String(params.byggId));
      // console.log(`☀️ Fetching solar data for bygg_id=${params.byggId}`);
    } else if (params.gnr && params.bnr) {
      searchParams.set('gnr', String(params.gnr));
      searchParams.set('bnr', String(params.bnr));
      if (params.seksjonsnummer) {
        searchParams.set('snr', String(params.seksjonsnummer));
      }
      // console.log(`☀️ Fetching solar data for gnr=${params.gnr}, bnr=${params.bnr}${params.seksjonsnummer ? `, snr=${params.seksjonsnummer}` : ''}`);
    } else {
      // console.log("⚠️ No parameters for solar lookup");
      return null;
    }
    
    // console.log(`☀️ Full URL: ${url}`);
    const query = searchParams.toString();
    const url = `${baseUrl}/solinnstraling${query ? `?${query}` : ''}`;
    const response = await fetch(url);
    // console.log(`☀️ Response status: ${response.status}`);
    
    if (!response.ok) {
      await response.text();
      // Optional: inspect response body here for debugging if needed.
      if (response.status === 404) {
        // console.log("⚠️ No solar data found (404)");
        return null;
      }
      throw new Error(`Solar service error: ${response.status}`);
    }
    
    const data = (await response.json()) as SolarServiceResponse;
    // console.log(`☀️ Solar data received:`, data);
    
    if (data.error) {
      // console.log(`⚠️ Solar service returned error: ${data.error}`);
      return null;
    }
    
    // Calculate filtered solar energy (only roof surfaces with radiation > 800 kWh/m²)
    let filteredSolarEnergy = 0;
    const minRadiation = 800; // kWh/m²
    const solarPanelEfficiency = 0.2; // 20% efficiency
    const takUtnyttelsesgrad = 0.85;
    
    if (Array.isArray(data.takflater)) {
      const filteredTakflater = data.takflater.filter(
        (tak) => tak.irr_kwh_m2_yr > minRadiation
      );

      filteredSolarEnergy = filteredTakflater.reduce(
        (sum: number, tak: SolarRoofSurface) =>
          sum + tak.irr_kwh_m2_yr * tak.area_m2 * takUtnyttelsesgrad * solarPanelEfficiency,
        0
      );
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
    console.warn("[solarEnergyService] Failed to fetch solar data", error);
    return null;
  }
}
