# Energirådgivning – Adresseoppslag

Oppdatert: 2025-02-15

## Kort oppsummert

Løsningen hjelper innbyggere i Oslo med energirådgivning basert på adresseoppslag. Den samler data fra Matrikkel-API, Enova, solkart og gul liste, og presenterer tilpassede energitiltak og støtteordninger.

- **building-info-service** samler data fra Matrikkel SOAP-API, Enova energimerke-API og PBE Solkart til ett samlet svar.
- **solar-service** proxier PBE Solkart WFS og normaliserer solinnstrålingsdata med automatisk delta-søk.
- **admin-api** håndterer innholdsstyring (tiltak, tilskudd, ordlister) med drafts, publisering og GCS-integrasjon.
- **API-server** (`src/api-server.ts`) eksponerer REST-endepunkter for frontend og serverer CMS-innhold.
- **Frontend** er en React 19-app med Vite, Tailwind CSS og Oslo kommunes Punkt-designsystem, med egne mobilvisninger.

## Tech stack

| Lag | Teknologi |
|-----|-----------|
| Frontend | React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4 |
| Designsystem | @oslokommune/punkt-react + punkt-css v13 |
| Animasjoner | Framer Motion 12 |
| Datahenting | SWR 2 |
| Validering | Zod 4 |
| Backend | Express 5, Node.js |
| SOAP | soap, fast-xml-parser, xml2js |
| Cloud | Google Cloud Storage |
| Metrikker | prom-client (Prometheus) |
| Testing | Vitest 4, Playwright, Storybook 10 |

## Repostruktur

```
services/
  building-info-service/   Matrikkel + Enova + sol-data aggregering
  solar-service/           PBE Solkart WFS proxy
  admin-api/               CMS: tiltak, tilskudd, ordlister, drafts, publisering
  admin-server/            Admin-server for admin-UI
  shared/                  Delt logging-infrastruktur
src/
  api-server.ts            Hoved-API som frontend bruker
  components/              React-komponenter (FigmaBlokk, mobil, felles)
  hooks/                   React hooks (adressesøk, energimerke, gul liste, viewport m.m.)
  services/                Typed klienter for API-kall, CSV, solenergi, bydelsstatistikk
  clients/                 SOAP-klienter (Matrikkel, Bygning, Bruksenhet, Store, Adresse)
  types/                   TypeScript-typer
  utils/                   Hjelpefunksjoner og logging
server/
  index.ts                 Matrikkel-proxy (port 3000)
content/
  tiltak/                  JSON-filer for energitiltak (serveres fra GCS i prod)
  tilskudd/                JSON-filer for tilskuddsordninger
  dictionaries/            Ordlister for CMS
scripts/                   TypeScript-verktøy for testing, analyse og innholdshåndtering
packages/config/           Typed runtime-konfigurasjon
deploy/marvin/             GitOps-manifester for Marvin
tests/
  unit/                    Enhetstester (Vitest)
  integration/             Integrasjonstester (LIVE=1)
  e2e/                     Ende-til-ende-tester (LIVE=1)
Dokumentasjon/             Refaktorlogg, observability, støttedokumenter
```

## Kom i gang

```bash
npm install
```

Kopier `.env.example` til `.env` (eller opprett `.env`) med nødvendige miljøvariabler (se [Konfigurasjon](#konfigurasjon-og-secrets)).

```bash
npm run dev           # Starter frontend, API-server, building-info-service og solar-service
npm run dev:local     # Variant uten solar-service
npm run dev:admin-api # Starter admin-API separat
```

Enkelt-tjenester:

```bash
npm run dev:client     # Kun frontend (Vite)
npm run dev:server     # Kun API-server/Matrikkel-proxy
npm run dev:buildings  # Kun building-info-service
npm run dev:solar      # Kun solar-service
```

## Arkitektur

### Building-info-service (`services/building-info-service/`)
- `context.ts` binder miljøvariabler, klienter og diagnoseflagg.
- `matrikkel.ts` orchestrerer SOAP-klientene (`MatrikkelClient`, `BygningClient`, `BruksenhetClient`, `StoreClient`) og henter supplerende data fra Enova og solkart.
- `resultAssembler.ts` kombinerer data fra Matrikkel-SOAP og Enova; velger beste kilder for areal/bygningstype/byggeår, og registrerer metrikker.
- `index.ts` er et tynt Express-skall som eksponerer `/lookup`, `/address/:address`, `/metrics` og `/health`, med caching (24 t) via `NodeCache`.
- `metrics.ts` definerer alle Prometheus-metrikker (`building_info_service_*`).

### Solar-service (`services/solar-service/`)
- Express-tjeneste som proxier PBE Solkart WFS og normaliserer solinnstrålingsdata.
- Støtter flere oppslag: `bygg_id`, `polygon`, `gnr/bnr/snr`, `lat/lon`.
- Automatisk delta-søk med konfigurerbare forsøk og tidsbegrensning.
- Mock-modus via `SOLAR_SERVICE_MOCK=1` for utvikling og testing.

### Admin-API (`services/admin-api/`)
- Innholdsstyring for tiltak, tilskudd og ordlister.
- Draft-støtte med separat lagring (`*.draft.json`).
- Publisering til GCS-bucket via Cloud Build-triggers.
- Autentisering og autorisasjon for redaksjonelt innhold.
- Endepunkter under `/admin/api/*`.

### API-server (`src/api-server.ts`)

Eksponerer REST-endepunktene frontend bruker:

| Endepunkt | Beskrivelse |
|-----------|-------------|
| `POST /api/address-lookup` | Adresseoppslag mot building-info-service |
| `GET /api/address-suggestions` | Adresseforslag via Geonorge |
| `POST /api/energy-rating` | Energimerkeberegning |
| `POST /api/gul-liste/sjekk-adresse` | Gul liste-sjekk via adresse |
| `POST /api/gul-liste/sjekk-gnr-bnr` | Gul liste-sjekk via GNR/BNR |
| `USE /api/solar` | Proxy til solar-service |
| `GET /config/app.json` | Runtime-konfigurasjon for SPA |
| `GET /config/content/:collection/index.json` | Innholdskatalog (tiltak/tilskudd) |
| `GET /config/content/<path>` | Enkelt innholdselement |
| `GET /config/dictionaries/index.json` | Ordlister for CMS |
| `GET /health` | Helsesjekk |
| `GET /metrics` | Prometheus-metrikker (proxy fra building-info-service) |

Serverer også runtime-innhold fra GCS-bucket (`CONTENT_BUCKET`) med ETag-basert caching, eller fra lokalt filsystem i utvikling.

### Frontend

- React 19-app med Vite og TypeScript.
- Oslo kommunes Punkt-designsystem for UI-komponenter.
- Tailwind CSS for styling, Framer Motion for animasjoner.
- SWR for datahenting med caching.
- Zod-schemas for validering av innholdsdata.
- Egne mobilvisninger (`MobileLanding`, `MobileEnergySolutions`, `MobileTiltakDetail`).
- Storybook for komponentdokumentasjon (`npm run storybook`).

**Viktige hooks:**
- `useFigmaAddressSearch` – adressesøk og oppslag
- `useEnergyRatingEstimator` – energimerkeberegning
- `useGulListeStatus` – gul liste-sjekk
- `useMatrikkelenheter` – matrikkelenheter
- `useResponsive` – responsiv layout
- `useFigmaViewportMetrics` – viewport-metrikker
- `contentHooks` – innholdshenting fra CMS

## Dataflyt

1. Bruker søker adresse i frontend.
2. API-server (`/api/address-lookup`) kaller `resolveBuildingData`.
3. `matrikkel.ts` henter data fra Matrikkel SOAP, Enova API og solkart.
4. `resultAssembler.ts` kombinerer data og velger beste kilder for hvert felt.
5. Svar caches (24 t TTL) og returneres med `_meta`-felt til frontend.
6. Frontend viser tilpassede energitiltak og støtteordninger basert på bygningsdata.

## Eksterne avhengigheter

| System/Tjeneste | Type | Bruk |
|-----------------|------|------|
| Matrikkel SOAP (`MatrikkelenhetService`, `BygningService`, `BruksenhetService`, `StoreService`) | SOAP | Hovedkilde for bygg- og enhetsdata |
| Enova API | REST | Offisiell energiattest |
| PBE Solkart (via `solar-service`) | WFS/REST | Takflater, solinnstråling og filtrert solenergi |
| Geonorge adresse-API | REST | Adresseforslag i `/api/address-suggestions` |
| PBE Gul liste (WFS_SOK) | WFS | Gul liste-sjekk i `/api/gul-liste/*` |
| Google Cloud Storage | REST | Innholdslagring for tiltak/tilskudd/ordlister |

## Konfigurasjon og secrets

Miljøvariabler lastes via `packages/config`. I utvikling brukes `.env`. Sett `DOTENV_CONFIG_PATH` for alternativ plassering.

### Kritiske variabler
- `MATRIKKEL_USERNAME`, `MATRIKKEL_PASSWORD`, `MATRIKKEL_API_BASE_URL_*` – Matrikkel SOAP-tilgang
- `ENOVA_API_KEY` – Enova energimerke-API
- `API_PORT` / `PORT` – porter for tjenestene

### Runtime-konfigurasjon
- `PUBLIC_API_BASE_URL`, `PUBLIC_SOLAR_BASE_URL` – base-URL for SPA (`/config/app.json`)
- `APP_CONFIG_DIR` – katalog for `app.json` (default `content/`)
- `CONTENT_BUCKET` – GCS-bucket for innhold (uten: bruker lokalt filsystem)
- `CONTENT_BUCKET_PREFIX` – prefiks i GCS-bucket (default `content`)

### Solar-service
- `SOLAR_WFS_URL`, `SOLAR_MAP_FILE`, `SOLAR_LAYER`, `SOLAR_REFERENCE_KWH`
- `SOLAR_CACHE_TTL`, `SOLAR_POINT_DELTA`, `SOLAR_MIN_RADIATION`, `SOLAR_PANEL_EFFICIENCY`
- `SOLAR_SERVICE_PORT`, `SOLAR_SERVICE_HOST`, `SOLAR_SERVICE_MOCK`
- `SOLAR_POINT_AUTO_DELTAS`, `SOLAR_POINT_PLATEAU_DELTA`, `SOLAR_POINT_MAX_ATTEMPTS`, `SOLAR_POINT_TIME_LIMIT_MS`
- `SOLAR_ADRID_BUFFER`, `SOLAR_ADDRESS_MAP`, `SOLAR_ADDRESS_LAYER`

### Gul liste og Geonorge
- `GUL_LISTE_WFS_URL`, `GUL_LISTE_WFS_SEARCH_MAP`, `GUL_LISTE_TABLE_MAP`, `GUL_LISTE_TABLE`
- `GEONORGE_API_BASE`, `GEONORGE_API_USER_AGENT`, `GEONORGE_DEFAULT_MUNICIPALITY`

### Diagnoseflagg
- `LIVE`, `LOG_SOAP`, `DEBUG_BUILDING_INFO`, `API_DEBUG` – holdes av i prod

> Marvin-miljøer bruker External Secrets Operator / Key Vault. Unngå å logge secrets.

## Innholdsstyring (CMS)

Innhold for tiltak og tilskudd styres via admin-API og lagres i GCS:

- **Tiltak** (`content/tiltak/`) – energitiltak med Zod-validerte schemas
- **Tilskudd** (`content/tilskudd/`) – tilskuddsordninger
- **Ordlister** (`content/dictionaries/`) – termer og definisjoner
- **Drafts** – utkast lagres separat (`*.draft.json`) og publiseres via admin-API
- **Validering**: `npm run content:validate`
- **Publisering**: `npm run content:publish`

## Observability

- `building-info-service` eksponerer Prometheus-metrikker (`building_info_service_*`) på `/metrics`.
- `collectDefaultMetrics` er aktivert.
- Se `Dokumentasjon/Utvikling/prometheus-metrikker.md` for full metrikkliste, labels og forslag til dashboards/alerts.

## Testing og verifisering

```bash
npm run verify          # Typecheck + lint + kontrakttester + smoke
npm run verify:ci       # Typecheck + lint + kontrakttester (CI)
npm run test:unit       # Enhetstester (Vitest)
npm run test:integration # Integrasjonstester (krever LIVE=1)
npm run test:e2e        # Ende-til-ende-tester (krever LIVE=1)
npm run test:all        # Alle tester sekvensielt
npm run test:watch      # Watch-modus
npm run test:contract   # Kontrakttester for Matrikkel/resultAssembler
npm run test:full-chain # Full kjede med solar-, building-info- og API-tjenester
npm run test:smoke      # Smoke-test mot stubbet building-info-service
npm run storybook       # Komponentdokumentasjon på localhost:6006
```

## Deploy

```bash
docker build -t energiveiledning:local .
docker run --rm -p 14000:4000 --env-file .env energiveiledning:local
curl http://localhost:14000/health
```

For å teste API-server fra samme image:

```bash
CONTAINER=$(docker run -d --env-file .env -p 14000:4000 -p 13001:3001 energiveiledning:local)
docker exec -d $CONTAINER node ./dist/backend/api-server.mjs
curl http://localhost:13001/health
docker stop $CONTAINER
```

GitOps-manifester i `deploy/marvin/` (External Secrets, Argo CD). Manifester kjører begge backend-containere i samme pod.

## Operasjonelle sjekkpunkter

- **Cache**: NodeCache med 24 t TTL; tøm via `cache.flushAll()` eller restart.
- **Health**: `GET /health` på building-info-service og API-server.
- **Diagnoseflagg**: `LIVE`, `LOG_SOAP`, `DEBUG_BUILDING_INFO`, `API_DEBUG` – kun ved behov.
