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

### `npm run verify`
- Sammensatt sjekk som kjører `tsc --noEmit`, `eslint` (hele prosjektet) og kontrakttestene under `scripts/`. Kommandoen skal være grønn før merge/deploy.
- Kjøring tar om lag 2–3 minutter lokalt. Sørg for at `.env.local` eller `DOTENV_CONFIG_PATH` peker på et miljø med testbruker før du starter.
- Ved feil: les hele loggen for å identifisere hvilket delsteg som feilet. Type- og lint-feil vises først; kontrakttester logger hvilken kontrakt som brøt forventningen. Fiks avviket og kjør verify på nytt.
- Etter fullført kjøring (grønn eller rød) skal resultatet noteres i `Dokumentasjon/Utvikling/refaktor-oversikt.md` under statuslogg. Inkluder tidspunkt og relevante funn.

### Øvrige tester
- `npm run test:contract` – kontrakttester for Matrikkel/resultAssembler/metrics. Brukes når integrasjoner eller observability-laget endres.
- `npm run test:full-chain` – spinner opp solar-, building-info- og API-tjenestene og kjører ende-til-ende med adressen `Grenseveien 99, 0663 Oslo`. Krever tilgang til eksterne tjenester (kjør uten sandbox eller med mock).
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
