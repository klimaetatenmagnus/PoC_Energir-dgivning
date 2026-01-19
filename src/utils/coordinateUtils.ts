/**
 * Koordinatkonvertering og Oslo kommune kart-utilities
 *
 * Bruker Bymiljøetatens karttjeneste for å vise kart med Oslo kommune-stil.
 * Dokumentasjon: Dokumentasjon/Utvikling/oslo-kart-implementering.md
 */

import proj4 from 'proj4';

// Definer UTM32N projeksjon (EPSG:25832) - brukt av Oslo kommune
proj4.defs(
  'EPSG:25832',
  '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

/**
 * Konverterer WGS84 koordinater (lat/lng) til UTM32N (EPSG:25832)
 */
export const wgs84ToUtm32 = (lat: number, lng: number): { x: number; y: number } => {
  const [x, y] = proj4('EPSG:4326', 'EPSG:25832', [lng, lat]);
  return { x, y };
};

/**
 * Lag-IDer for minimalt kartsett:
 * - 22, 23: Vegnett
 * - 31: Bygningsflater
 * - 41: Vann (sjøer, elver)
 * - 43: Arealbruk (parker, grøntområder)
 */
const OSLO_MAP_LAYERS = 'show:22,23,31,41,43';

const OSLO_MAP_BASE_URL =
  'https://geodata.bymoslo.no/arcgis/rest/services/geodata/Bakgrunnskart/MapServer/export';

/**
 * Genererer URL for Oslo kommune kartbilde sentrert rundt et punkt
 *
 * @param lat - Breddegrad (WGS84)
 * @param lng - Lengdegrad (WGS84)
 * @param width - Bildets bredde i piksler
 * @param height - Bildets høyde i piksler
 * @param bufferMeters - Radius rundt punktet i meter (default 150m)
 */
export const getOsloMapExportUrl = (
  lat: number,
  lng: number,
  width: number,
  height: number,
  bufferMeters: number = 150
): string => {
  const { x, y } = wgs84ToUtm32(lat, lng);

  // Juster buffer basert på aspektforhold for å unngå forvrengning
  const aspectRatio = width / height;
  const bufferX = bufferMeters * aspectRatio;
  const bufferY = bufferMeters;

  const bbox = `${x - bufferX},${y - bufferY},${x + bufferX},${y + bufferY}`;

  const params = new URLSearchParams({
    bbox,
    bboxSR: '25832',
    imageSR: '25832',
    layers: OSLO_MAP_LAYERS,
    size: `${width},${height}`,
    format: 'png32',
    transparent: 'true',
    f: 'image',
  });

  return `${OSLO_MAP_BASE_URL}?${params}`;
};
