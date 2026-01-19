# Implementeringsplan: Oslo kommune karttjeneste

## Implementeringslogg

### 2024-12-15: Grunnimplementering fullført

**Utførte steg:**

| Steg | Status | Beskrivelse |
|------|--------|-------------|
| 1. Installere proj4 | Fullført | `npm install proj4 @types/proj4` |
| 2. Opprette coordinateUtils.ts | Fullført | Ny fil: `src/utils/coordinateUtils.ts` |
| 3. Oppdatere WhiteInfoBox.tsx | Fullført | Erstattet 3x3 tile-grid med enkelt kartbilde |
| 4. Oppdatere MobileInfoBox.tsx | Fullført | Erstattet iframe med img + markør |
| 5. Oppdatere MobileInfoBox.css | Fullført | Nye stiler for map-wrapper, map-image, map-pin, map-attribution |
| 6. Testing | Fullført | Verifisert på desktop og mobil med Karl Johans gate 1 |

**Endrede filer:**
- `src/utils/coordinateUtils.ts` (ny)
- `src/components/FigmaBlokk/components/WhiteInfoBox.tsx`
- `src/components/mobile/MobileInfoBox.tsx`
- `src/components/mobile/MobileInfoBox.css`

**Testresultater:**
- Desktop: Kart vises korrekt med bygninger, veinett og markør
- Mobil: Kart vises korrekt med attribution "Kart: Bymiljøetaten, Oslo kommune"
- CORS: Ingen problemer observert
- TypeScript: Ingen typefeil
- ESLint: Ingen linting-feil

### Gjenstående oppgaver

| Oppgave | Prioritet | Beskrivelse |
|---------|-----------|-------------|
| ~~Fjerne ubrukt getTileUrl~~ | ~~Lav~~ | ~~Funksjonen i calculations.ts brukes ikke lenger~~ (Fullført) |
| Implementere fallback | Medium | Falle tilbake til OSM hvis Bymiljøetaten er nede |
| Vurdere caching | Lav | Kartbilder caches ikke - vurdere for ytelse |
| Teste flere adresser | Lav | Verifisere kant-tilfeller (utenfor Oslo, osv.) |

---

## Bakgrunn

Løsningen bruker i dag OpenStreetMap tiles for å vise kartvisning av adresser. For å gi et mer "Oslo kommune"-preg skal dette erstattes med Bymiljøetatens offisielle karttjeneste.

## Tidligere implementering (erstattet)

### Filer som ble endret
- `src/components/FigmaBlokk/components/WhiteInfoBox.tsx` (linje 879-935)
- `src/components/mobile/MobileInfoBox.tsx` (linje 335-361)
- `src/components/mobile/MobileInfoBox.css` (linje 203-244)

### Tidligere tile-URL (OpenStreetMap)
```
https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png
```

### Ny implementering (Oslo kommune)
```
https://geodata.bymoslo.no/arcgis/rest/services/geodata/Bakgrunnskart/MapServer/export?bbox=...&layers=show:22,23,31,41,43&...
```

## Ny karttjeneste: Bymiljøetaten

### Tjenestedetaljer

| Egenskap | Verdi |
|----------|-------|
| Leverandør | Bymiljøetaten, Oslo kommune |
| Type | ArcGIS MapServer med WMS/WMTS |
| Lisens | NLOD (Norsk lisens for offentlige data) |
| Koordinatsystem | EPSG:25832 (UTM sone 32N) |
| Tile-størrelse | 256x256 px |
| Kontakt | geodata@bym.oslo.kommune.no |

### Endepunkter

```
REST:  https://geodata.bymoslo.no/arcgis/rest/services/geodata/Bakgrunnskart/MapServer
WMTS:  https://geodata.bymoslo.no/arcgis/rest/services/geodata/Bakgrunnskart/MapServer/WMTS
WMS:   https://geodata.bymoslo.no/arcgis/services/geodata/Bakgrunnskart/MapServer/WMSServer
```

## Valg av lag

Karttjenesten har 57 lag. For en enkel visning velges følgende:

### Minimalt lagsett

| Lag-ID | Navn | Beskrivelse |
|--------|------|-------------|
| 31 | Bygningsflater | Bygninger som polygoner |
| 22-23 | Vegnett | Veier i ulike skalaer |
| 41 | Vann flate | Vannspeil (sjøer, elver) |
| 43 | Arealbruksflate | Parker, grøntområder |

### Lag som IKKE inkluderes
- Symboler og tekst (0-11) - unødvendig for liten visning
- Grenser (12-15) - ikke relevant
- Kollektivtrafikk (16-20) - for detaljert
- Høydekurver (46) - unødvendig kompleksitet

## Implementeringsalternativer

### Alternativ A: WMS Export (anbefalt for SVG)

Bruk REST API med `export`-endepunktet for å hente statiske kartbilder:

```typescript
const getOsloMapUrl = (lat: number, lng: number, width: number, height: number) => {
  // Konverter fra WGS84 (lat/lng) til UTM32N (EPSG:25832)
  const [x, y] = wgs84ToUtm32(lat, lng);

  // Beregn bounding box rundt punktet (ca 200m radius)
  const buffer = 200; // meter
  const bbox = `${x - buffer},${y - buffer},${x + buffer},${y + buffer}`;

  // Velg kun ønskede lag
  const layers = 'show:22,23,31,41,43';

  return `https://geodata.bymoslo.no/arcgis/rest/services/geodata/Bakgrunnskart/MapServer/export?` +
    `bbox=${bbox}&` +
    `bboxSR=25832&` +
    `layers=${layers}&` +
    `size=${width},${height}&` +
    `format=png32&` +
    `transparent=true&` +
    `f=image`;
};
```

**Fordeler:**
- Enkelt å implementere
- Fungerer direkte i SVG `<image>`-elementer
- Kan velge spesifikke lag
- Ingen behov for tile-koordinat-beregning

**Ulemper:**
- Krever koordinatkonvertering (WGS84 → UTM32)
- Statisk bilde (ingen interaktivitet)

### Alternativ B: WMTS Tiles

Bruk cached tiles for bedre ytelse:

```typescript
const WMTS_BASE = 'https://geodata.bymoslo.no/arcgis/rest/services/geodata/Bakgrunnskart/MapServer/WMTS/tile';

const getWmtsTileUrl = (level: number, row: number, col: number) => {
  return `${WMTS_BASE}/1.0.0/geodata_Bakgrunnskart/default/default028mm/${level}/${row}/${col}`;
};
```

**Fordeler:**
- Raskere lasting (cached tiles)
- Standard tile-struktur

**Ulemper:**
- Kan ikke velge spesifikke lag
- Krever beregning av tile-matriks for UTM32

## Koordinatkonvertering

Nåværende løsning bruker WGS84 (lat/lng fra Geonorge). Bymiljøetatens kart bruker UTM32N (EPSG:25832).

### Konverteringsformel

```typescript
// Proj4-definisjon for UTM32N
const UTM32N = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';

// Bruk proj4js biblioteket
import proj4 from 'proj4';

proj4.defs('EPSG:25832', UTM32N);

const wgs84ToUtm32 = (lat: number, lng: number): [number, number] => {
  return proj4('EPSG:4326', 'EPSG:25832', [lng, lat]);
};
```

### Avhengighet
```bash
npm install proj4
npm install -D @types/proj4
```

## Implementeringssteg

### Steg 1: Installer proj4
```bash
npm install proj4 @types/proj4
```

### Steg 2: Opprett koordinatkonverterings-utility
Ny fil: `src/utils/coordinateUtils.ts`

```typescript
import proj4 from 'proj4';

// Definer UTM32N projeksjons
proj4.defs('EPSG:25832', '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs');

export const wgs84ToUtm32 = (lat: number, lng: number): { x: number; y: number } => {
  const [x, y] = proj4('EPSG:4326', 'EPSG:25832', [lng, lat]);
  return { x, y };
};

export const getOsloMapExportUrl = (
  lat: number,
  lng: number,
  width: number,
  height: number,
  bufferMeters: number = 150
): string => {
  const { x, y } = wgs84ToUtm32(lat, lng);

  // Juster buffer basert på aspektforhold
  const aspectRatio = width / height;
  const bufferX = bufferMeters * aspectRatio;
  const bufferY = bufferMeters;

  const bbox = `${x - bufferX},${y - bufferY},${x + bufferX},${y + bufferY}`;

  // Lag-IDer: Vegnett (22,23), Bygninger (31), Vann (41), Arealbruk (43)
  const layers = 'show:22,23,31,41,43';

  const params = new URLSearchParams({
    bbox,
    bboxSR: '25832',
    imageSR: '25832',
    layers,
    size: `${width},${height}`,
    format: 'png32',
    transparent: 'true',
    f: 'image'
  });

  return `https://geodata.bymoslo.no/arcgis/rest/services/geodata/Bakgrunnskart/MapServer/export?${params}`;
};
```

### Steg 3: Oppdater WhiteInfoBox.tsx

Erstatt nåværende tile-logikk (linje 879-935) med:

```typescript
import { getOsloMapExportUrl } from '../../../utils/coordinateUtils';

// I komponenten, erstatt kartvisningen:
{mapCoordinates && (
  <>
    <clipPath id="mapClip">
      <rect x="0" y={MAP_TOP_Y} width={MAP_WIDTH} height={MAP_HEIGHT} />
    </clipPath>
    <g clipPath="url(#mapClip)">
      <image
        x="0"
        y={MAP_TOP_Y}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        href={getOsloMapExportUrl(mapCoordinates.lat, mapCoordinates.lng, MAP_WIDTH, MAP_HEIGHT)}
        preserveAspectRatio="xMidYMid slice"
      />
    </g>
    <g transform={`translate(${MAP_WIDTH / 2 - 14} ${MAP_TOP_Y + MAP_HEIGHT / 2 - 32})`}>
      <LocationPin />
    </g>
  </>
)}
```

### Steg 4: Oppdater MobileInfoBox.tsx

Erstatt OpenStreetMap iframe (linje 342-358) med tilsvarende implementering.

### Steg 5: Fjern ubrukt kode

Slett `getTileUrl` fra `calculations.ts` dersom den ikke brukes andre steder.

## Testing

### Testpunkter
1. Verifiser at kartet vises korrekt for kjente Oslo-adresser
2. Sjekk at markøren plasseres riktig i sentrum
3. Test på både desktop og mobil
4. Verifiser at CORS-policy tillater bildene

### Testadresser
- Karl Johans gate 1, Oslo (sentrum)
- Holmenkollveien 100, Oslo (utenfor sentrum)
- Rådhusplassen 1, Oslo (ved vann)

## Fallback-strategi

Hvis Bymiljøetatens tjeneste er nede, kan vi falle tilbake til OpenStreetMap:

```typescript
const [useOsloMap, setUseOsloMap] = useState(true);

const handleImageError = () => {
  console.warn('Oslo map failed to load, falling back to OSM');
  setUseOsloMap(false);
};
```

## Lisensiering

Bymiljøetatens data er tilgjengelig under NLOD (Norsk lisens for offentlige data).

Krav:
- Kildeangivelse: "Kart: Bymiljøetaten, Oslo kommune"
- Kan vises som diskret tekst under kartet

## Estimert arbeidsmengde

| Oppgave | Kompleksitet |
|---------|--------------|
| Installere proj4 | Lav |
| Koordinatkonvertering | Lav |
| Oppdatere WhiteInfoBox | Medium |
| Oppdatere MobileInfoBox | Medium |
| Testing og finjustering | Medium |
| Dokumentasjon | Lav |

## Åpne spørsmål

1. **CORS**: Må verifisere at geodata.bymoslo.no tillater cross-origin requests
2. **Ytelse**: Export-endepunktet genererer bilder on-demand - kan være tregere enn cached tiles
3. **Cache**: Vurdere om vi bør cache kartbilder lokalt/i CDN
4. **Zoom-nivå**: Bestemme optimal buffer-størrelse for god lesbarhet

## Referanser

- [Bymiljøetatens geodatatjenester](https://nyhetsrom.bymiljoetaten.no/kart-og-geodata/)
- [ArcGIS REST API Export Map](https://developers.arcgis.com/rest/services-reference/enterprise/export-map/)
- [Proj4js dokumentasjon](http://proj4js.org/)
- [Oslo designmanual - Kartstil](https://designmanual.oslo.kommune.no/kartstil)
