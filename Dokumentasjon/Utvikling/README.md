# Building-info-service og adresseoppslag

Oppdatert: 2025-09-28 (refaktor runde 2)

## Kort oppsummert
- `building-info-service` samler Matrikkel-, Enova- og solkart-data til ett svar som brukes av API-serveren og frontend (inkludert Figma-modus).
- Tjenesten er modulær: konfigurasjon hentes via `packages/config`, eksterne kall er kapslet i egne klienter og resultatet settes sammen i `resultAssembler`.
- Observability-laget er etablert med Prometheus-metrikker på `/metrics`, kontrakttester og standard testløp (`npm run verify`).

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

## Frontend-hook-arkitektur

### `useFigmaAddressSearch` (`src/hooks/useFigmaAddressSearch.ts`)
- Holder hele adresseoppslags-flowen for både Figma-prototypen og blokkomponenten. Hooken styrer `figma` → `figma-blokk`-modusen, håndterer fade-effektene og eksponerer UI-state (søkeverdi, forslag, valgt indeks, feilmeldinger, loader-flagg).
- Leser og skriver mot `buildingApi.fetchSuggestions` og `buildingApi.lookupAddress`. Forslagene debounces (`300 ms`) før kall mot `/api/address-suggestions`, og ferdige adresseoppslag trigges via `lookupAddress` som reflekterer backend-svaret 1:1.
- Inneholder tre test-triggere (tast `1`, `2` eller `3`) som kobler inn statiske resultat fra `testData/*`. Disse brukes i Figma-demoer og lar designteamet validere flater uten nettverk.
- Gir tilbake hjelpefunksjoner til komponentene (`handleSearch`, `handleInputChange`, `highlightSuggestion`, `openSuggestions`, `handleBack`) slik at UI-delen er en ren «view» uten API-kunnskap.

### `useEnergyRatingEstimator` (`src/hooks/useEnergyRatingEstimator.ts`)
- Tar inn domenemodellen fra `BuildingApiService` og beregner energimerke lokalt. Hooken normaliserer bygningstype (`småhus`/`blokk`), TEK-label og trekker ut eventuelle Enova-attester.
- Synker konsumfeltet automatisk dersom backenden leverer energiattest (`energiattest.registering.beregnetLevertEnergiTotaltkWh`) og oppdaterer intensitet/rating fortløpende.
- Eksponerer beregnings-APIet som brukes av UI: `toggleMeasure`, `getSavings`, `openSimulation`, `totalSavings` osv. Simuleringsmatrisen ligger i hooken og bygger på TEK + boligtype; frontend trenger ikke egne slår-opp-tabeller.

### `useGulListeStatus` (`src/hooks/useGulListeStatus.ts`)
- Wrapper gul liste-endepunktene og velger riktig API basert på tilgjengelig data: adresse (`/api/gul-liste/sjekk-adresse`) eller gnr/bnr (`/api/gul-liste/sjekk-gnr-bnr`).
- Sørger for loading-/error-state, cancellerer fetch ved unmount (AbortController) og kaller valgfri callback når status endrer seg slik at resten av UI kan reagere.
- Eksponerer `refetch()` slik at komponenten kan trigge nytt oppslag når brukeren endrer utvalg eller backend-data er blitt oppdatert.

> Tips: Alle hookene returnerer ferdig normaliserte data. Evt. videreutvikling bør skje i hookene slik at Figma-modusen, Appen og framtidige integrasjoner fortsatt deler samme regler.

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

### Marvin egress- og proxykrav

| Avhengighet | Endpoint/host | Protokoll | Tilgang i Marvin |
| --- | --- | --- | --- |
| Matrikkel SOAP | `https://{env}.matrikkel.no/matrikkelapi/wsapi/v1/service/*` | HTTPS/SOAP over 443 | Krever egress-allowlist; vurder Squid-proxy for dynamiske hoster. 
| Geonorge adresse-API | `https://ws.geonorge.no/adresser/v1/*` | HTTPS/REST | Tillat outbound 443 (kan gå direkte via egress). |
| Enova Energiattest | `https://api.data.enova.no/.../Energiattest` | HTTPS/REST | Tillat outbound 443; API-key via Key Vault/ExternalSecret. |
| PBE Solkart | `https://od2.pbe.oslo.kommune.no/cgi-bin/wms` | HTTPS/WMS/WFS | Tillat outbound 443; kan kreve proxy hvis ikke åpnet i egress. |
| OpenStreetMap (kartfliser) | `https://tile.openstreetmap.org/*` | HTTPS | Kun nødvendig i demo; vurder å blokkere i prod. |

- For sikkerhetsnivå *Zero-Trust* må egress-regler uttrykkelig whiteliste hostene over. Se `Dokumentasjon/Utvikling/Om nettverk.pdf` for detaljer om Egress Firewall og Squid.
- HTTP-proxy: sett `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY` i Deployment dersom namespace bruker Squid. Pass på at SOAP-klientene (axios) arver proxy-config fra env.
- Ingress: denne applikasjonen eksponeres internt; ekstern ingress må konfigureres separat (ikke dekket her).

## Konfigurasjon og secrets

- All runtime-konfigurasjon hentes via `packages/config/src/runtime.ts`.
- Nødvendige variabler (prod/test) inkluderer `MATRIKKEL_USERNAME`, `MATRIKKEL_PASSWORD`, `MATRIKKEL_API_BASE_URL_*`, `ENOVA_API_KEY`, `API_PORT`, `PORT`, `LIVE`, `LOG_SOAP`.
- I Marvin injiseres verdier via External Secrets Operator/Key Vault. Lokalt brukes `.env.local`/`.env` (lastes automatisk). Sett `DOTENV_CONFIG_PATH` dersom filen ligger et annet sted.
- Diagnoseflagg (`LIVE`, `LOG_SOAP`, `DEBUG_BUILDING_INFO`, `API_DEBUG`) skal være av i prod og kun brukes midlertidig ved feilsøking.

## Containerisering

- `npm run build:backend` (esbuild) lager ferdigkompilerte ESM-artefakter i `dist/backend` for `building-info-service` og `api-server` slik at vi slipper `ts-node` i produksjon.
- `npm run build:prod` kjører både frontend-build (`vite build`) og backend-builden over. Kommandoen brukes i Docker-builden.
- `Dockerfile` (rot) er en multi-stage bygg som:
  - installerer avhengigheter (`npm ci`),
  - kjører `npm run build:prod`,
  - pruner devDependencies før runtime-laget settes opp.
- Runtime-laget kopierer med nødvendige ressursfiler (`Matrikkel 2023.csv`, `stotteordninger_data.json`, `stotteordning_cache.py`) og eksponerer portene `3001` (API) og `4000` (building-info-service).
- Default `CMD` starter `building-info-service`. Sett `CMD ["node", "./dist/backend/api-server.mjs"]` (eller overstyr i Marvin-manifestet) dersom API-serveren skal være hovedprosessen.
- Eksempel: `docker build -t energiveiledning:latest .` og `docker run --rm -p 4000:4000 --env-file .env.local energiveiledning:latest`.

## GitOps / Marvin-maler

- `deploy/marvin/` inneholder eksempler på namespace, SecretStore/ExternalSecret, ConfigMap, Deployment (med både `building-info-service` og `api-server`-container), Service og ServiceMonitor.
- `kustomization.yaml` samler ressursene slik at Argo CD kan synke hele pakken.
- `argocd-application.yaml` og `applicationset.yaml` viser hvordan repositoriet kan kobles inn i Marvin via Argo CD (enkeltmiljø og multi-miljø).
- Oppdater `repoURL`, `targetRevision`, Key Vault-navn, namespace og image-tag (`{TAG}`) når manifestene kopieres over i GitOps-repoet.
- Python-runtime: imagen bruker `python3` for `stotteordning_cache.py`. Sørg for at base layer har Python (ev. legg til install-steg) eller sett `PYTHON_BINARY` i env.
- Røyktest (lokal): `docker build -t energiveiledning:local .`, `docker run --rm -p 14000:4000 -p 13001:3001 --env-file .env.local energiveiledning:local`, `curl http://localhost:14000/health` og `curl http://localhost:13001/health`.

## Observability

- `building-info-service` eksponerer Prometheus-metrikker på `/metrics`. Navnekonvensjonen er `building_info_service_<område>_*` og dekker oppslag, cache, eksterne kall og resultatsammensetning.
- Standard `collectDefaultMetrics` er aktivert med prefix `building_info_service_`.
- Kontrakttester i `scripts/test-contract-*.ts` validerer at metrikker registreres som forventet og at Matrikkel-responsene fortsatt dekker kjente scenarier.
- Logging kontrolleres via `logging.ts`. Unngå å logge secrets – modulene bruker kun diagnoseflagg for ekstra detaljer.
- Se `Dokumentasjon/Utvikling/prometheus-metrikker.md` for full liste over metrikker, labels, forslag til dashboards og ServiceMonitor-utkast.

## Test- og verifiseringsløp

### `npm run verify`
- Sammensatt sjekk som kjører `tsc --noEmit`, `eslint` (hele prosjektet) og kontrakttestene under `scripts/`. Kommandoen skal være grønn før merge/deploy.
- Kjøring tar om lag 2–3 minutter lokalt. Sørg for at `.env.local` eller `DOTENV_CONFIG_PATH` peker på et miljø med testbruker før du starter.
- Ved feil: les hele loggen for å identifisere hvilket delsteg som feilet. Type- og lint-feil vises først; kontrakttester logger hvilken kontrakt som brøt forventningen. Fiks avviket og kjør verify på nytt.
- Etter fullført kjøring (grønn eller rød) skal resultatet noteres i `Dokumentasjon/Utvikling/refaktor-oversikt.md` under statuslogg. Inkluder tidspunkt og relevante funn.

### Øvrige tester
- `npm run test:contract` – kontrakttester for Matrikkel/resultAssembler/metrics. Brukes når integrasjoner eller observability-laget endres.
- `npm run test:full-chain` – starter `services/solar-service`, building-info-service og API-server via `scripts/test-full-chain.ts` (tsx). End-to-end lookup mot `Grenseveien 99, 0663 Oslo` bekrefter hele flyten.
  - Bruk `--mock` eller sett `SOLAR_SERVICE_MOCK=1` for å bruke den innebygde solkart-stuben (unngår utgående trafikk). Uten flagg rutes mot PBE Solkart.
  - Skriptet avslutter tjenestene når testen er ferdig; forvent exit code 0 i loggen for hver tjeneste.
  - Krever lokal kjøring uten MacosSeatbelt-sandbox for at `http://localhost`-trafikk skal fungere.
- `LIVE=1 node --loader ts-node/esm scripts/test-known-addresses.ts` – sjekker kjente adresser mot levende tjenester; nyttig etter endringer i byggvalg eller fallbacklogikk.
- `npm run dev` – lokal integrasjonstest (frontend + backend + solar). Krever ferdig satt `.env`.

Logg fortsatt alle større testrunder i `Dokumentasjon/Utvikling/refaktor-oversikt.md` slik at refaktoreringens historikk holdes oppdatert.

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

Tidligere versjoner av dokumentasjonen lå i `Overlevering/Adresseoppslag-rapport.md` (nå `Overlevering/README.md`) som separat rapport. Endringene fra refaktor runde 2 er nå samlet her.
