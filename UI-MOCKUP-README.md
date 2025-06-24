# UI Mock-up for Adresseoppslag

## Oversikt
Dette er en React-basert UI for testing av adresseoppslag mot LIVE Matrikkel/Geonorge/Enova API-er. Løsningen er forberedt for integrasjon med Punkt designsystem.

## Arkitektur

### Frontend (Port 5173)
- **AddressSearch** - Søkefelt med validering
- **ResultsTable** - Tabell for visning av bygningsdata  
- **LoadingSpinner** - Visuell lasting-indikator
- **ErrorDisplay** - Feilhåndtering med logging

### Backend API (Port 3001)
- Express server som eksponerer `resolveBuildingData`
- Kjører med `LIVE=1` for ekte API-kall mot:
  - Geonorge (adresseoppslag)
  - Matrikkel (bygningsdata)
  - Enova (energiattest)

## Hvordan starte

### Metode 1: Alt-i-ett script (anbefalt)
```bash
./start-ui-only.sh
```
Dette starter både API-server og UI automatisk.

### Metode 2: Manuelt (to terminaler)
```bash
# Terminal 1 - Start API server
LIVE=1 pnpm tsx src/api-server.ts

# Terminal 2 - Start kun UI (ikke hele dev-stacken)
pnpm run dev:client
```

## Bruk

1. Åpne **http://localhost:5173** i nettleseren
2. UI-et starter automatisk i "Adresseoppslag"-modus
3. Skriv inn en adresse og klikk "Søk"
4. Resultater vises i tabell med:
   - Matrikkeldata (GNR/BNR/SNR)
   - Byggeår og bruksareal
   - Bygningstype
   - Energiattest (hvis tilgjengelig)
   - Koordinater

## Test-adresser

Disse adressene er verifisert å fungere:
- **Kapellveien 156B, 0493 Oslo** - Tomannsbolig fra 1952
- **Kapellveien 156C, 0493 Oslo** - Tomannsbolig fra 2013
- **Kjelsåsveien 97B, 0491 Oslo** - Rekkehus

## Feilsøking

### Browser console
- `[AddressSearch]` - Input-validering og søk
- `[BuildingApiService]` - API-kall og responstider
- `[API Server]` - Backend-logging (sjekk terminal)
- `[ErrorDisplay]` - Detaljerte feilmeldinger

### Vanlige problemer

**"Failed to fetch"**
- Sjekk at API-serveren kjører på port 3001
- Test: `curl http://localhost:3001/health`

**Blank side**
- Sjekk browser console for JavaScript-feil
- Sørg for at du bruker `pnpm run dev:client`, ikke `pnpm run dev`

**Timeout**
- Matrikkel API kan være treg, spesielt første gang
- Normal responstid: 2-5 sekunder

## Miljøvariabler

API-serveren respekterer:
- `LIVE=1` - Bruker ekte API-er (påkrevd)
- `LOG_SOAP=1` - Logger SOAP-meldinger til `/soap-dumps/`
- `API_PORT=3001` - Port for API-server (default: 3001)

## Forberedelser for Punkt

CSS-variabler klare for Punkt-integrasjon:
```css
--primary-color: #0062BA;     /* Oslo kommune blå */
--spacing-unit: 8px;          /* Grunnleggende spacing */
--border-radius: 4px;         /* Standard border-radius */
```

Komponent-mapping:
| Vår komponent | Punkt-komponent |
|---------------|-----------------|
| AddressSearch | pkt-input + pkt-button |
| ResultsTable | pkt-table |
| LoadingSpinner | pkt-spinner |
| ErrorDisplay | pkt-alert |

## Teknisk detalj

Når du bytter mellom moduser i UI-et:
- **"Adresseoppslag"** - Bruker ny API på port 3001
- **"Debug-modus"** - Bruker gammel hook (krever port 4002)
- **"Veileder"** - Krever debug-data

For å unngå konflikter bruker vi kun den gamle hooken når vi er i debug/veileder-modus.