# Energirådgivning – Adresseoppslag

Oppdatert: 2025-09-28 (refaktor runde 2)

## Kort oppsummert
- `building-info-service` samler Matrikkel-, Enova- og solkart-data til ett svar som brukes av API-serveren og frontend (inkludert Figma-modus).
- `src/api-server.ts` eksponerer REST-endepunktene (`/api/address-lookup`, `/api/address-suggestions`, `/api/energy-rating`) og kjører Python-skript for støtteordningsdata.
- React-appen bruker typed klienter og hooks (`buildingApi`, `useFigmaAddressSearch`, `useEnergyRatingEstimator`, `useGulListeStatus`) slik at demoer, blokk-komponent og full app deler samme logikk.
- Observability-laget henger sammen: Prometheus-metrikker på `/metrics`, kontrakttester og standard verify-løp (`npm run verify`).

## Reposstruktur
- `services/building-info-service/` – modulene som henter og sammenstiller data fra Matrikkel, Enova og solkart.
- `src/` – API-server, frontend-klienter og React-app (inkludert hooks og UI).
- `scripts/` – TypeScript/Node-verktøy, Python-skript (`scripts/python/`) og hjelpe-skript som `scripts/start-ui-only.sh`.
- `data/raw/` – importerte kilder (Matrikkel CSV, støtteordning Excel, energimerkegrenser).
- `data/generated/` – artefakter generert av `scripts/python/stotteordning_cache.py`.
- `packages/config/` – typed runtime-konfigurasjon.
- `deploy/marvin/` – eksempelmanifester for GitOps/Marvin.
- `Dokumentasjon/` – refaktorlogg, observability-detaljer og øvrig støtteinformasjon.

## Kom i gang
- `npm install` – installer avhengigheter.
- `npm run dev` – starter frontend, API-server, building-info-service og solar-service lokalt (bruk `.env`).
- `npm run dev:local` – variant med subsidy-service.
- `npm run dev:server` / `npm run dev:buildings` / `npm run dev:solar` – start enkelt-tjenester ved behov.

> Miljøvariabler lastes via `packages/config`. I utvikling brukes `.env.local`/`.env`. Sett `DOTENV_CONFIG_PATH` hvis filen ligger et annet sted.

## Arkitektur

### Building-info-service (`services/building-info-service/`)
- `context.ts` binder miljøvariabler, klienter og diagnoseflagg.
- `matrikkel.ts` orchestrerer SOAP-klientene (`MatrikkelClient`, `BygningClient`, `BruksenhetClient`, `StoreClient`) og henter supplerende data (Enova, solkart, CSV).
- `resultAssembler.ts` velger beste kilder for areal, byggeår og energiattest, og registrerer metrikker.
- `index.ts` er et tynt Express-skall som eksponerer `/lookup`, `/address/:address`, `/metrics` og `/health`, med caching (24 t) via `NodeCache`.
- `metrics.ts` definerer alle Prometheus-metrikker (`building_info_service_*`).

### API-lag (`src/api-server.ts`)
- Eksponerer REST-endepunktene som frontend bruker og legger på `_meta`-felt (respons-tid).
- Kjører Python-skript fra `scripts/python/` via `runPythonScript`; Python-binær autodetekteres, men kan overstyres med `PYTHON_BINARY`.
- Har egen health-check på `/health`, bruker CORS for lokale domener og deler konfigurasjon fra `packages/config`.

### Frontend-klienter og hooks
- `src/services/buildingApi.ts` er typed klient for `/api/address-lookup` og mock-modus.
- `useFigmaAddressSearch`, `useEnergyRatingEstimator` og `useGulListeStatus` kapsler API-logikken og sørger for at Figma-modus og app deler samme regler.
- Hooksene eksponerer ferdig normaliserte data og håndterer feilhåndtering, loading og testmodus.

## Dataflyt
1. Bruker søker adresse i frontend (`BuildingApiService.lookupAddress`).
2. API-server (`/api/address-lookup`) kaller `resolveBuildingData` med valgt byggvalg-modus.
3. `matrikkel.ts` henter data fra Matrikkel, Enova, solkart og CSV-fallback.
4. `resultAssembler.ts` kombinerer data og registrerer kilder/metrikker.
5. `index.ts` cache’er svaret, måler varighet og returnerer JSON.
6. API-serveren legger på `_meta`-felt og sender resultatet til frontend-hookene.

## Eksterne avhengigheter

| System/Tjeneste | Type | Bruk |
| ---------------- | ---- | ---- |
| Matrikkel SOAP (`MatrikkelenhetService`, `BygningService`, `BruksenhetService`, `StoreService`) | SOAP | Hovedkilde for bygg- og enhetsdata |
| Enova API | REST | Offisiell energiattest der tilgjengelig |
| PBE Solkart (intern `services/solar-service`) | WFS/REST | Takflater, solinnstråling og filtrert solenergi |
| CSV-filer (`data/raw/…`, `data/generated/stotteordninger_data.json`) | Fil | Fallback for historiske takflater/støtteordninger |
| Geonorge adresse-API | REST | Adresseforslag i `/api/address-suggestions` |

## Konfigurasjon og secrets
- `packages/config/src/runtime.ts` laster og validerer env-variabler.
- Kritiske variabler: `MATRIKKEL_USERNAME`, `MATRIKKEL_PASSWORD`, `MATRIKKEL_API_BASE_URL_*`, `ENOVA_API_KEY`, `API_PORT`, `PORT`, `LIVE`, `LOG_SOAP`, `API_DEBUG`.
- Marvin-miljøer bruker External Secrets Operator/Key Vault; lokalt brukes `.env`. Unngå å logge secrets – diagnoseflagg er av som standard.

## Observability
- `building-info-service` eksponerer Prometheus-metrikker (`building_info_service_*`) på `/metrics`; `collectDefaultMetrics` er aktivert.
- Kontrakttester i `scripts/test-contract-*.ts` validerer metrikker, Matrikkel-flyt og resultatsammensetning.
- Se `Dokumentasjon/Utvikling/prometheus-metrikker.md` for full metrikkliste, labels og forslag til dashboards/alerts.

## Testing og verifisering
1. `npm run verify` – kjører `tsc --noEmit`, `npm run lint` og kontrakttester. Skal være grønn før leveranse (eventuelle gjenstående lint-avvik er dokumentert i refaktor-oversikten).
2. `npm run test:contract` – kjører kun kontrakttestene for Matrikkel/resultAssembler/metrics.
3. `npm run test:full-chain` – starter solar-, building-info- og API-tjenestene og kjører ende-til-ende-oppslag (`--mock` eller `SOLAR_SERVICE_MOCK=1` bruker solkart-stub).
4. `LIVE=1 node --loader ts-node/esm scripts/test-known-addresses.ts` – validerer kjente adresser mot levende tjenester.
5. `npm run dev` – lokal integrasjonstest (frontend + backend + solar). Krever gyldig `.env`.

> Logg alle større testløp i `Dokumentasjon/Utvikling/refaktor-oversikt.md` (dato, klokkeslett, funn).

## Operasjonelle sjekkpunkter
- Cache: NodeCache med 24 t TTL; tøm via `cache.flushAll()` eller restart tjenesten.
- Health: `GET /health` på både building-info-service (`PORT`) og API-server (`API_PORT`).
- Feilhåndtering: Eksterne kall er instrumentert; alarmer i Marvin bør bruke `building_info_service_*`-metrikker.
- Diagnoseflagg (`LIVE`, `LOG_SOAP`, `DEBUG_BUILDING_INFO`, `API_DEBUG`) holdes av i prod og aktiveres kun ved behov.
- Python-runtime: `src/api-server.ts` autodetekterer `python3`. Sett `PYTHON_BINARY` hvis binæren heter noe annet.

## Python-skript og dataressurser
- `scripts/python/stotteordning_cache.py` genererer `data/generated/stotteordninger_data.json` og `src/data/stotteordningData.js`.
- Råkilder ligger i `data/raw/` (Matrikkel CSV, støtteordning Excel, energimerkegrenser). Hold filnavn intakt – skript refererer til dem eksplisitt.
- `scripts/start-ui-only.sh` starter alle backends og UI uten å kjøre full dev-stack.

## Røyktest og deploy
- Bygg: `docker build -t energiveiledning:local .`
- Kjør: `docker run --rm -p 14000:4000 -p 13001:3001 --env-file .env energiveiledning:local`
- Verifiser: `curl http://localhost:14000/health` og `curl http://localhost:13001/health`
- GitOps-manifester, External Secrets og Argo CD-oppsett finnes i `deploy/marvin/` (se egen README for detaljer og tilpasning).

## Dokumentasjon og ansvar
- `Dokumentasjon/Utvikling/refaktor-oversikt.md` – single source of truth for plan, status, testlogg og videre tiltak.
- `Dokumentasjon/Utvikling/prometheus-metrikker.md` – observability-detaljer, dashboards og alarmforslag.
- Overleveringsmateriell (`Overlevering/`) inneholder støttedokumenter for UI-prosess, bygningstype-logikk, nettverk, GitOps m.m.
- Deployment-/Marvin-teamet eier drift, observability og GitOps-oppsett. Produktteamet oppdaterer refaktor-oversikten og denne README-en ved funksjonelle endringer.
