# Rapport: Adresseoppslag i Matrikkel-systemet

Oppdatert: 2025-09-28 (refaktor runde 2)

## Kort oppsummert
- `building-info-service` samler Matrikkel-, Enova- og solkart-data til ett svar som brukes av API-serveren og frontend (inkludert Figma-modus).
- Tjenesten er nå modulær: konfigurasjon hentes via `packages/config`, eksterne kall er kapslet i egne klienter og resultatet settes sammen i `resultAssembler`.
- Observability-laget er etablerte med Prometheus-metrikker på `/metrics`, kontrakttester og standard testløp (`npm run verify`).

## Arkitektur og hovedkomponenter

### building-info-service (`services/building-info-service/`)
- `context.ts` binder miljøvariabler, klienter og flagg. Den bruker `packages/config` som henter Secrets/konfig fra `.env` i dev eller Key Vault/External Secrets i Marvin.
- `matrikkel.ts` orchestrerer oppslag mot Matrikkel-klientene (`MatrikkelClient`, `BygningClient`, `BruksenhetClient`, `StoreClient`) og Enova/solkart.
- `resultAssembler.ts` velger beste kilde for areal, byggeår og energiattest, samt inkluderer soldata og CSV-fallback når nødvendig.
- `index.ts` er et tynt Express-skall som eksponerer `/lookup`, `/address/:address`, `/health` og `/metrics`. Resultater caches i `NodeCache` (24 timer TTL) og måles med Prometheus.
- `metrics.ts` definerer alle Prometheus-metrikker (`building_info_service_*`) for oppslag, cache, eksterne kall og kildene resultatet benytter.
- `logging.ts` samler logging og respekterer diagnoseflagg (`DEBUG_BUILDING_INFO`, `LOG_SOAP`).

### API-lag (`src/api-server.ts`)
- Eksponerer REST-endepunktene som frontend bruker (`/api/address-lookup`, `/api/address-suggestions`, `/api/energy-rating`).
- Gjenbruker `resolveBuildingData` fra `building-info-service` og tilfører metadata (varighet, tidsstempel).
- Kjører Python-scripts via `runPythonScript` ved behov (støtteordning-cache). Python-binær autodetekteres og kan overstyres med `PYTHON_BINARY`.
- Har egen health check på `/health` og støtter CORS for lokale utviklingsdomener.

### Frontend-klient (`src/services/buildingApi.ts`)
- Typet klient som kaller `/api/address-lookup` eller bruker mock-data i Figma/UI-demoer.
- Samme svarmodell brukes på tvers av React-app og Figma-modus.

## Dataflyt

1. Bruker søker adresse i frontend (`BuildingApiService.lookupAddress`).
2. API-server (`/api/address-lookup`) kaller `resolveBuildingData` med valgt byggvalg-modus.
3. `matrikkel.ts` gjør SOAP-oppslag mot Matrikkel-tjenestene via klientene i `src/clients/*` og henter supplerende data (Enova, solkart, CSV-fallback).
4. `resultAssembler.ts` kombinerer resultatet og registrerer kilder/metrikker.
5. `index.ts` (building-info-service) cache'er svaret, måler varighet og returnerer JSON.
6. API-serveren legger på `_meta`-felt (respons-tid) og sender svaret til frontend.

## Eksterne avhengigheter

| System/Tjeneste | Type | Bruk |
| ---------------- | ---- | ---- |
| Matrikkel SOAP (`MatrikkelenhetService`, `BygningService`, `BruksenhetService`, `StoreService`) | SOAP | Hovedkilde for bygg- og enhetsdata |
| Enova API | REST | Offisiell energiattest der tilgjengelig |
| PBE Solkart (intern `services/solar-service`) | WFS/REST | Takflater, solinnstråling og filtrert solenergi |
| CSV-filer (`stotteordninger_data.json`, `public`-data) | Fil | Fallback for historiske takflater/støtteordninger |
| Geonorge adresse-API | REST | Adresseforslag i `/api/address-suggestions` |

## Konfigurasjon og secrets

- All runtime-konfigurasjon hentes via `packages/config/src/runtime.ts`.
- Nødvendige variabler (prod/test) inkluderer `MATRIKKEL_USERNAME`, `MATRIKKEL_PASSWORD`, `MATRIKKEL_API_BASE_URL_*`, `ENOVA_API_KEY`, `API_PORT`, `PORT`, `LIVE`, `LOG_SOAP`.
- I Marvin injiseres verdier via External Secrets Operator/Key Vault. Lokalt brukes `.env.local`/`.env` (lastes automatisk). Sett `DOTENV_CONFIG_PATH` dersom filen ligger et annet sted.
- Diagnoseflagg (`LIVE`, `LOG_SOAP`, `DEBUG_BUILDING_INFO`, `API_DEBUG`) skal være av i prod og kun brukes midlertidig ved feilsøking.

## Observability

- `building-info-service` eksponerer Prometheus-metrikker på `/metrics`. Navnekonvensjonen er `building_info_service_<område>_*` og dekker oppslag, cache, eksterne kall og resultatsammensetning.
- Standard `collectDefaultMetrics` er aktivert med prefix `building_info_service_`.
- Kontrakttester i `scripts/test-contract-*.ts` validerer at metrikker registreres som forventet og at Matrikkel-responsene fortsatt dekker kjente scenarier.
- Logging kontrolleres via `logging.ts`. Unngå å logge secrets – modulene bruker kun diagnoseflagg for ekstra detaljer.
- Se `Dokumentasjon/Utvikling/prometheus-metrikker.md` for full liste over metrikker, labels, forslag til dashboards og ServiceMonitor-utkast.

## Test- og verifiseringsløp

1. `npm run verify` – kjører `tsc --noEmit`, `npm run lint` og kontrakttester. Må være grønn før leveranse (frontend-legacy med kjente lint-avvik er dokumentert i refaktor-oversikten).
2. `npm run test:contract` – kjører kun kontrakttestene for Matrikkel/resultAssembler/metrics. Bruk ved endringer i klienter, observability eller dataflyt.
3. `npm run test:full-chain` – starter solar-, building-info- og API-tjenestene og kjører et ende-til-ende-oppslag (default adresse `Grenseveien 99, 0663 Oslo`). Krever ubegrenset nettverkstilgang.
4. `LIVE=1 node --loader ts-node/esm scripts/test-known-addresses.ts` – validerer kjente adresser mot levende tjenester. Brukes ved endringer i byggvalg og fallbacklogikk.
5. `npm run dev` – lokal integrasjonstest (frontend + backend + solar). Sørg for at `.env` er satt med test-bruker.

Logg resultat og funn i `Dokumentasjon/Utvikling/refaktor-oversikt.md` etter hver større kjøring.

## Operasjonelle sjekkpunkter

- HTTP-cache: NodeCache med 24t TTL. Tøm ved behov med `cache.flushAll()` i REPL eller restart tjenesten.
- Health-endepunkt: `GET /health` på både building-info-service (port `PORT`) og API-server (port `API_PORT`).
- Timeout/feilhåndtering: Eksterne kall er instrumentert; feil registreres både som metrikker og i logg. Sørg for at alarmer i Marvin følger metrikknavnene ovenfor.
- Python-avhengighet: `src/api-server.ts` autodetekterer Python 3. Sett `PYTHON_BINARY` i miljøet dersom standard `python3` ikke finnes.

## Kjente begrensninger

- PBE Solkart leverer fortsatt ufullstendige data for enkelte adresser; resultatet merkes med `filteredSolarEnergy = 0` og metrics teller hvor mange resultater som mangler sol-data.
- Frontend har gjenstående lint-avvik (se refaktor-oversikten). Dette påvirker ikke backend, men gjør at `npm run verify` kan feile inntil området er ryddet.
- Matrikkel-testmiljø kan være tregt; kontrakttestene bruker mocker der det er nødvendig, men ende-til-ende-tester mot testmiljø må kjøres manuelt.

## Referanser

- `Dokumentasjon/Utvikling/refaktor-oversikt.md` – kontinuerlig status og neste steg.
- `Dokumentasjon/Utvikling/prometheus-metrikker.md` – detaljert observability-dokumentasjon.
- `services/building-info-service/` – kildekode for modulene beskrevet over.
- `src/api-server.ts`, `src/services/buildingApi.ts` – API-lag og frontend-klient.

## Historikk

Tidligere versjoner av dokumentet (før refaktor runde 2) beskrev eldre implementasjoner med monolittisk `building-info-service/index.ts`, UI-spesifikke detaljer og manuelle energimerke-beregninger. Referanser finnes i Git-historikken dersom du trenger kontekst.
