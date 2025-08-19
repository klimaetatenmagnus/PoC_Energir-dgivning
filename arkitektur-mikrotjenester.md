# Arkitektur - FigmaBlokk Energirådgivningssystem

## Oversikt

FigmaBlokk er et mikrotjenestebasert system for energirådgivning til boligeiere i Oslo kommune. Systemet består av en React-frontend og tre separate backend-mikrotjenester som kommuniserer via REST API.

## Mikrotjenester

### 1. Building Info Service (Port 4000)

**Hovedansvar**: Samle og koordinere bygningsinformasjon fra multiple datakilder

**Teknologi**: Node.js/TypeScript, Express

**Datakilder**:
- Matrikkel API (SOAP)
- Geonorge Adresse API 
- Enova Energiattest API
- CSV-filer med historisk bygningsdata
- Oslo Kommune Gul Liste API

**Kjernefunksjonalitet**:
- Adresseoppslag og geokoding
- Bygningsdata-aggregering
- Energiattest-henting
- Seksjonshåndtering
- Cache (24 timer)

**Endepunkter**:
- `GET /lookup?adresse=<adresse>`
- `GET /address/:address`
- `GET /health`

### 2. Solar Service (Port 4003)

**Hovedansvar**: Beregne solinnstråling og solcellepotensial

**Teknologi**: Node.js/JavaScript, Express

**Datakilde**: PBE Solkart 2024 WFS-tjeneste

**Kjernefunksjonalitet**:
- Solinnstråling per takflate
- Filtrering av egnede takflater (>800 kWh/m²)
- Beregning av solcellepotensial (20% virkningsgrad)
- Cache (1 time)

**Endepunkter**:
- `GET /solinnstraling?bygg_id=<id>`
- `GET /solinnstraling?lat=<lat>&lon=<lon>`
- `GET /solinnstraling?gnr=<gnr>&bnr=<bnr>`

### 3. Subsidy Service (Port 4001)

**Hovedansvar**: Håndtere støtteordninger

**Teknologi**: Node.js/JavaScript, Express

**Status**: Stub-implementasjon for PoC

**Endepunkter**:
- `GET /subsidy?tiltak=<tiltaksnavn>`

## Frontend-arkitektur

### Hovedkomponent: FigmaMainScript.tsx

**Ansvar**: Orkestrering av brukergrensesnitt og dataflyt

**Hovedfunksjoner**:
1. **Adressesøk**: Integrerer med AddressSearch-komponenten
2. **Bygningsvisualisering**: Animerer mellom Oslo skyline og bygningsdetaljer
3. **Energitiltak**: Presenterer 8 standard energitiltak
4. **Gul liste-håndtering**: Spesialtilpassede tiltak for vernede bygninger
5. **Energikarakterberegning**: Estimerer før/etter energikarakter

### Dataflyt

```
1. Bruker → Adressesøk → Geonorge API
2. Adresse → Building Info Service → Aggregert bygningsdata
3. Bygningsdata → Solar Service → Solpotensial
4. Bygningsdata → Frontend → Energitiltaksberegninger
5. Valgte tiltak → Energispareberegning → Ny energikarakter
```

## Integrasjoner

### Eksterne APIer
- **Geonorge**: Adresseoppslag og geokoding
- **Matrikkel**: Autoritativ bygningsdata
- **Enova**: Energiattester
- **PBE Solkart**: Solinnstråling
- **Oslo Kommune WFS**: Gul liste status

### Interne tjenester
- **CSV Service**: Historisk bygningsdata
- **Gul Liste Service**: Vernestatus-sjekk

## Sikkerhetsarkitektur

- API-nøkler lagret som miljøvariabler
- CORS aktivert for cross-origin requests
- Ingen autentisering (offentlig tjeneste)

## Skalerbarhet

- Mikrotjenester kan skaleres individuelt
- Cache reduserer belastning på eksterne APIer
- Frontend kan deployes statisk (CDN)

## Teknisk stack

**Frontend**:
- React 18 med TypeScript
- Vite som build-verktøy
- Tailwind CSS
- Oslo Kommune designsystem

**Backend**:
- Node.js med Express
- TypeScript/JavaScript
- NodeCache for caching
- Proj4 for koordinattransformasjoner

## Deployment

- Frontend: Vite build → statiske filer
- Backend: 3 separate Node.js-prosesser
- Start-script: `./start-ui-only.sh`

