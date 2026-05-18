// Service for fetching and calculating solar energy data
import proj4 from 'proj4';
import { getAppConfig } from '../runtimeConfig.ts';
import { calculateFilteredSolarEnergy } from '../utils/solarFilter.ts';

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
  filteredSolarEnergy?: number;
  error?: unknown;
};

export async function fetchSolarData(params: {
  bygningsnummer?: string | number;
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
    const { solarProxyBaseUrl } = getAppConfig();
    const baseUrl = solarProxyBaseUrl.replace(/\/$/, '');

    // Konverter UTM → WGS84 hvis kun representasjonspunkt er gitt.
    let lat = params.lat;
    let lon = params.lon;
    if (!lat && !lon && params.representasjonspunkt) {
      const wgs84Coords = proj4("EPSG:32632", "EPSG:4326", [
        params.representasjonspunkt.east,
        params.representasjonspunkt.north
      ]);
      lon = wgs84Coords[0];
      lat = wgs84Coords[1];
    }

    // CSV-først: hvis bygningsnummer er kjent, slå opp i lokal WFS-snapshot
    // via backend. Samme formel som sameie-aggregatet — sikrer at enkeltadresse
    // og sameie gir identisk filteredSolarEnergy for samme bygg.
    if (params.bygningsnummer != null && params.bygningsnummer !== '') {
      const csvUrl = `${baseUrl}/bygning/${encodeURIComponent(String(params.bygningsnummer))}`;
      const csvResponse = await fetch(csvUrl);
      if (csvResponse.ok) {
        const csvData = (await csvResponse.json()) as SolarServiceResponse;
        if (!csvData.error) {
          return finalizeSolarData(csvData);
        }
      } else if (csvResponse.status !== 404) {
        // Andre feil enn 404 indikerer at backend er nede — fall tilbake til
        // live-proxy slik at brukeren fortsatt får et estimat.
        console.warn(
          `[solarEnergyService] CSV-oppslag feilet (${csvResponse.status}), faller tilbake til live PBE`,
        );
      }
      // 404 → bygget finnes ikke i WFS-snapshot (typisk nyoppførte bygg).
      // Fall tilbake til live PBE Solkart under.
    }

    // Live PBE Solkart (fallback / koordinat-/gnrbnr-baserte oppslag).
    const searchParams = new URLSearchParams();
    if (params.bygningsnummer != null && params.bygningsnummer !== '') {
      searchParams.set('bygningsnummer', String(params.bygningsnummer));
    } else if (lat && lon) {
      searchParams.set('lat', String(lat));
      searchParams.set('lon', String(lon));
    } else if (params.byggId) {
      searchParams.set('bygg_id', String(params.byggId));
    } else if (params.gnr && params.bnr) {
      searchParams.set('gnr', String(params.gnr));
      searchParams.set('bnr', String(params.bnr));
      if (params.seksjonsnummer) {
        searchParams.set('snr', String(params.seksjonsnummer));
      }
    } else {
      return null;
    }

    const query = searchParams.toString();
    const url = `${baseUrl}/solinnstraling${query ? `?${query}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      await response.text();
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Solar service error: ${response.status}`);
    }

    const data = (await response.json()) as SolarServiceResponse;
    if (data.error) {
      return null;
    }

    return finalizeSolarData(data);
  } catch (error) {
    console.warn("[solarEnergyService] Failed to fetch solar data", error);
    return null;
  }
}

/**
 * Normaliserer respons fra både CSV-endpoint og live PBE-proxy til samme shape,
 * og (re)beregner filteredSolarEnergy med felles filter for å sikre konsistens
 * uansett kilde.
 */
function finalizeSolarData(data: SolarServiceResponse): SolarEnergyData {
  const takflater = Array.isArray(data.takflater) ? data.takflater : [];
  const filteredSolarEnergy =
    typeof data.filteredSolarEnergy === 'number'
      ? data.filteredSolarEnergy
      : calculateFilteredSolarEnergy(takflater);
  return {
    takAreal_m2: data.takAreal_m2,
    sol_kwh_m2_yr: data.sol_kwh_m2_yr,
    sol_kwh_bygg_tot: data.sol_kwh_bygg_tot,
    solKategori: data.category,
    takflater: data.takflater,
    filteredSolarEnergy: Math.round(filteredSolarEnergy),
  };
}
