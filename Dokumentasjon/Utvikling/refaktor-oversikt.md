# Refaktorering mot Marvin (Standard namespace)

> Dokumentet samler målsetninger, plan og logg for refaktoreringen.

---

## Hvordan lese dette dokumentet

- **Aktiv refaktorering – runde 2** (nedenfor) beskriver alt vi jobber med etter reetableringen i september 2025.
- **Grunnlag** samler fortsatt gyldige mål, krav og Marvin-tilpasninger som gjelder uavhengig av runde.
- **Arkiv – runde 1** bevarer plan, logg og tiltak fra forrige forsøk slik at vi kan hente detaljer ved behov.

## Grunnlag – mål, krav og Marvin-tilpasninger

### Overordnede mål

- Gjøre kodebasen produksjonsklar for Marvin-plattformen (Standard namespace).
- Redusere teknisk gjeld og etablere tydelig modulstruktur.
- Sikre at konfigurasjon, secrets og drift er tilpasset GitOps/External Secrets.
- Forberede observability, logging og tester for kontinuerlig drift.

### Kritiske gaps (fra opprinnelig analyse)

- `services/building-info-service/index.ts` er monolitisk (>1 000 linjer) og håndterer alt fra HTTP til SOAP.
- Serverkode blander browser-/Node-moduler; feil runtime-paths når TypeScript kjøres direkte.
- Miljøhåndtering via `loadEnv.ts` logger hemmeligheter og baserer seg på implicit globale verdier.
- React-appen blander UI, API-kall og mock-data i `src/App.tsx`.
- Dataressurser (CSV, JSON, Python) lastes synkront ved oppstart uten validering/refresh-strategi.
- Deploy/dev-scripts avhenger av `.env`/ts-node og mangler Docker/GitOps-beskrivelse.

### Marvin-spesifikke krav (utdrag)

- Secret management via Azure Key Vault + External Secrets Operator; ingen hemmeligheter i kode/logg.
- GitOps-struktur med ArgoCD Application/ApplicationSet, `targetRevision`-tagger, Helm/Kustomize.
- Egress og proxies skal kunne konfigureres (Geonorge, Matrikkel, Enova, PBE Solkart m.fl.).
- Observability: strukturert logging, Prometheus-metrikker, Grafana-varsling.
- Datahåndtering må støtte asynkron lasting/validering, mulig uthenting fra ConfigMap/volum senere.

### Marvin-konfigurasjon (tidligere "Marvin-tilpasning.md")

#### Miljøvariabler & secrets

| Variabel                            | Bruk                       | Kilde                                 | Kommentar                |
| ----------------------------------- | -------------------------- | ------------------------------------- | ------------------------ |
| `MATRIKKEL_API_BASE_URL_PROD`     | Matrikkel SOAP base (prod) | Key Vault `matrikkel-base-url-prod` | Konfigurerbar per miljø |
| `MATRIKKEL_API_BASE_URL_TEST`     | Matrikkel SOAP base (test) | Key Vault `matrikkel-base-url-test` | Brukes i test/stage      |
| `MATRIKKEL_USERNAME`              | Bruker prod                | Key Vault `matrikkel-username`      | Skal ikke logges         |
| `MATRIKKEL_USERNAME_TEST`         | Bruker test                | Key Vault `matrikkel-username-test` |                          |
| `MATRIKKEL_PASSWORD`              | Passord                    | Key Vault `matrikkel-password`      | Deles prod/test          |
| `ENOVA_API_KEY`                   | Energiattest               | Key Vault `enova-api-key`           | Valgfritt                |
| `API_PORT`                        | Node API port              | ConfigMap/env                         | Standard 3001            |
| `PORT`                            | Building-info/Solar port   | ConfigMap/env                         | 4000/4003 i dev          |
| `REACT_APP_API_BASE_URL`          | Frontend API               | ConfigMap/env                         | Default `/api`         |
| `VITE_BIS_BASE`                   | Frontend BIS-base          | ConfigMap/env (Vite)                  | Trim `/`               |
| `LOG_SOAP`, `DEBUG_*`, `LIVE` | Diagnose                   | settes kun i dev/test                 | Aktivér via env         |

> ⚠️ Variablene `PBE_IDENTIFY_TOLERANCE`, `PBE_MAP_BASE_URL`, `VITE_API_PROXY_URL` er ikke i bruk ennå. Revider når solkart-/proxy-refaktor gjøres.

**Oppsett:**

1. External Secrets per miljø (`SecretStore`, `ExternalSecret` → `secrets-building-info` etc.).
2. Typed konfig-modul (`server/config/runtime.ts`) erstatter `loadEnv.ts`—injiser env via pods.
3. Diagnoseflagg default `false` (live/log/DEBUG må eksplisitt settes).

#### Eksterne endepunkter (egress)

| Tjeneste              | URL/Host                                                         | Bruk           |
| --------------------- | ---------------------------------------------------------------- | -------------- |
| Matrikkel SOAP        | `https://{env}.matrikkel.no/matrikkelapi/wsapi/v1/service/...` | SOAP-klienter  |
| Geonorge              | `https://ws.geonorge.no/adresser/v1/*`                         | Adresseoppslag |
| Enova                 | `https://api.data.enova.no/.../Energiattest`                   | Energiattest   |
| PBE Solkart           | `https://od2.pbe.oslo.kommune.no/cgi-bin/wms`                  | Sol-data       |
| OpenStreetMap         | `https://tile.openstreetmap.org/...`                           | Kart           |
| Solar-service         | Intern                                                           | Egen pod       |
| Støtteordning-lenker | KlimaOslo/Enova/Riksantikvaren                                   | Kun lenker     |

Anbefalinger: sentraliser URL-er i config; støtt proxy (`HTTP_PROXY` etc.); logg destinasjon+latency.

#### GitOps & deploy

- Repo-struktur med `applications/`, `applicationsets/`, `namespace-secrets/` for ArgoCD.
- Dockerfile bygger JS-dist (`tsc`/`vite build`), entrypoint uten `ts-node`.
- CI publiserer image-tag som ArgoCD peker på via `targetRevision`/Helm values.

#### Observability

- Strukturert logging (pino/winston) med korrelasjons-ID.
- Prometheus-metrikker (HTTP latency, eksterne kall, cache hits/miss, feilrate).
- Dokumenter metrikknavn og loggsøk; sett opp Grafana-contact points.

#### Datahåndtering

- CSV/JSON-last må være asynkron og validert; planlegg volum/ConfigMap.
- Dokumenter warmup-prosessen og oppdateringsløp.

#### Lokal utvikling vs Marvin

- README bør skilte mellom lokal (`.env`, `npm run dev:*`) og Marvin (External Secrets) kjøring.
- Mock/test-data løsrives fra prod-bundler; toggles default "safe" (ingen logging av sensitive data).

### Referanser og vedlegg

- Opprinnelig plan (`refaktor-plan`) og Marvin-notat er innlemmet her; tidligere filer kan arkiveres.
- Se `Overlevering/refaktor-oversikt.md` (denne filen) som single source of truth fremover.

## Aktiv refaktorering – runde 2 (2025-09 →)

### Læringspunkter fra runde 1

- Tiltakslisten var riktig retning, men omfanget ble stort: backend, frontend, operasjoner og dokumentasjon ble forsøkt løst i samme sleng før grunnmur (build/test/observability) var på plass.
- Vi manglet en eksplisitt fase der vi etablerte minstekrav for Marvin-plattformen (External Secrets, egress-håndtering, Argo CD repos) før modulære endringer startet.
- `apps/backend`-struktur og pakker ble planlagt uten at eksisterende monolit var redusert stegvis, noe som økte risikoen for ufullstendige refaktorer (tapet av arbeid var et symptom).
- Observability-kravene (Pino, Prometheus, Grafana) ble adressert sent i planen; de bør flyttes frem slik at logging/metrics følger hver del-leveranse.

### Faseplan (aktive steg)

1. **Fase A – Plattformgrunnlag og sikring**
   - Reetabler verifiserbare bygg (`npm run build`, `npx tsc --noEmit`, `npm run lint`).
   - Dokumentér og innfør Marvin-basics: ExternalSecret/SecretStore mal, nettverksbehov (fra `Om nettverk.docx`), sikkerhetsnivå.
   - Lag enkel Dockerfile og runtime-config uten sideeffekter; klargjør for Key Vault.
2. **Fase B – Backend i moduler, steg for steg**
   - Kutte monolitten i `services/building-info-service/index.ts` i avgrensede moduler (context, matrikkel, resultat) uten å bygge ny app-struktur før testene er grønne.
   - Innfør felles `packages/config`/`packages/core-domain` gradvis og valider mot eksisterende scripts.
   - Legg til kontraktstester og målbare metrikker mens vi deler opp koden.
3. **Fase C – Observability, GitOps og drift**
   - Bygg Prometheus-/logging-laget og dokumentér Grafana-oppsettet (ref. `Om Grafana.docx`, `Om metrikker.docx`).
   - Lag eksempelmanifest for Application/ApplicationSet + secrets, men hold infrastrukturen utenfor applikasjonsrepoet.
   - Etabler `targetRevision`-strategi og test scripts for tag-flyt (`Kontinuerlig Deployment.docx`).
4. **Fase D – Frontend og DX**
   - Flytt datahåndtering til hooks og rydd mockdata uten å blokkere backend-leveransen.
   - Dokumenter utvikleropplevelse (local vs Marvin) og oppdater README/overlevering ved hver større endring.
5. **Fase E – Marvin deployment og leveranseartefakter**
   - Produser prod-klar `Dockerfile`/byggeoppskrift som ikke er avhengig av `ts-node`, og beskriv Python-runtime behovet for scripts.
   - Sjekk inn eksempelmanifester for `Deployment`/`Service`, `ExternalSecret`/`SecretStore`, `ServiceMonitor` og Argo CD Application/ApplicationSet.
   - Dokumenter egress/proxy-krav og nettverksavklaringer for eksterne avhengigheter (Matrikkel, Geonorge, Enova, PBE Solkart) i Marvin-notatene.

### Statuslogg (runde 2)

| Dato       | Beskrivelse                                                                                                                                                                                                                | Notater                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 2025-09-21 | Reetablerte `refaktor`-branch fra produksjon, oppdaterte strategi og dokumentasjon for nytt refaktor-løp.                                                                                                               | `README.md` og seksjon 7 i dette dokumentet beskriver ny plan.                      |
| 2025-09-21 | Opprettet modul `packages/config` for typed runtime-config, fjernet hemmelighets-logging (`loadEnv.ts`) og migrerte `server/index.ts` og `services/building-info-service/index.ts` til den nye konfigurasjonen. | Miljøkrav valideres nå sentralt, og standarden for logg/test i Fase A er oppdatert. |
| 2025-09-22 | La `src/services/solarEnergyService.ts` og `src/services/gul-liste-service.ts` tilbake i `tsconfig.json`, typed takflate-responsen og ryddet lint/tsc-funn i tjenestene. | `tsconfig.json`, `src/services/solarEnergyService.ts`, `src/services/gul-liste-service.ts` |
| 2025-09-23 | Tok `FigmaMainScript`, `EnergySolutionButtons` og `WhiteInfoBox` inn i `tsconfig`; ryddet refs/prop-typer slik at `npx tsc --noEmit` kjører grønt med Figma-path aktiv. | `tsconfig.json`, `src/components/FigmaMainScript.tsx`, `src/components/FigmaBlokk/components/**/*` |
| 2025-09-24 | Flyttet støtteordningshenting til felles `shared.ts`, typet alle Tiltak-/GulListe-komponenter og fjernet `any`/`console.log`; `npx tsc --noEmit`, `npx eslint src/components/FigmaBlokk/components/Tiltak` kjørt | `src/components/FigmaBlokk/components/Tiltak/**/*`, `src/components/FigmaBlokk/components/Tiltak/shared.ts` |
| 2025-09-24 | Hentet `ProsessenVidere`, `hooks` og `utils` inn i lint/tsc-løpet med typed Geonorge-respons og tydelig solar-parameter; `npx tsc --noEmit`, `npx eslint src/components/FigmaBlokk/hooks`, `npx eslint src/components/FigmaMainScript.tsx`, `npx eslint src/components/FigmaBlokk/utils` kjørt | `src/components/FigmaBlokk/hooks/useAddressCoordinates.ts`, `src/components/FigmaBlokk/utils/calculations.ts`, `src/components/FigmaMainScript.tsx` |
| 2025-09-24 | Ryddet `EnergySolutionButtons`/`WhiteInfoBox` med felles energispare-tabell, stabile hooks og fjernet konsoll-logging; `npx eslint src/components/FigmaBlokk/components`, `npx tsc --noEmit` kjørt | `src/components/FigmaBlokk/components/EnergySolutionButtons.tsx`, `src/components/FigmaBlokk/components/WhiteInfoBox.tsx` |
| 2025-09-24 | Fjernet legacy Debug/Wizard-flyten, `house.json` og `useBuildingInfo`; fokuserer App på lookup/Figma før videre backend-opprydding. `npx tsc --noEmit`, `npx eslint src/components/FigmaBlokk/components` kjørt | `src/App.tsx`, `public/house.json` (slettet), `src/components/DebugDataTable.tsx` (slettet), `src/hooks/useBuildingInfo.ts` (slettet), `src/types/House.ts` (slettet) |
| 2025-09-27 | Delte `services/building-info-service/index.ts` i `context.ts`, `matrikkel.ts` og `resultAssembler.ts`, oppdaterte matrikkel-/bygning-/bruksenhetklientene, la inn python-runner og leste Marvin-observabilitykrav. `npx tsc --noEmit` kjørt | `services/building-info-service/{index.ts,context.ts,matrikkel.ts,resultAssembler.ts}`, `src/clients/{BygningClient.ts,BruksenhetClient.ts,MatrikkelClient.ts}`, `src/api-server.ts`, `Dokumentasjon/Utvikling/Om metrikker.pdf` |
| 2025-09-27 | Eksponerte Prometheus-metrikker (`/metrics`), instrumenterte matrikkel-/solkall og resultAssembler-kilder, og la til kontraktstester for begge modulene. `npm run test:contract`, `npx tsc --noEmit` kjørt | `services/building-info-service/{index.ts,metrics.ts,matrikkel.ts,resultAssembler.ts}`, `scripts/test-contract-{matrikkel,resultAssembler}.ts`, `package.json`, `tsconfig.contract.json` |
| 2025-09-28 | Standardiserte verifikasjonsløpet med `npm run typecheck`/`npm run verify`, opprettet GitHub Actions-workflow og beskrev forslag til dashboards/alerts for GitOps-handover. | `package.json`, `.github/workflows/verify.yml`, `Dokumentasjon/Utvikling/prometheus-metrikker.md` |
| 2025-09-28 | Ryddet console-logging og `any`-bruk i backend-klientene og API-serveren; la inn delt debug-logger, typed Bruksenhet-respons og oppdaterte håndover-dokumenter. | `services/building-info-service/{logging.ts,resultAssembler.ts,matrikkel.ts}`, `src/clients/{BygningClient.ts,BruksenhetClient.ts,MatrikkelClient.ts,StoreClient.ts}`, `src/api-server.ts`, `README.md` |
| 2025-09-28 | Typet forbedret building-selection (v1/v2), fjernet `console.log` og brukte felles helper for byggnummer. `npx eslint services/building-info-service/improved-building-selection*.ts` kjørt. | `services/building-info-service/improved-building-selection.ts`, `services/building-info-service/improved-building-selection-v2.ts` |
| 2025-09-28 | Ryddet legacy i proxy/server og backend-tjenester (`buildingApi`, `csvService`, gul liste-integration); erstattet `any`, la til typer for rå CSV-logger og fjernet `console.log`. `npx eslint server/index.ts src/services/{buildingApi,csvService,gul-liste-integration}.ts` kjørt. | `server/index.ts`, `src/services/{buildingApi.ts,csvService.ts,gul-liste-integration.ts}` |
| 2025-09-28 | Oppdaterte dokumentasjonen for adresseoppslag: all informasjon er samlet i rot-`README.md` med modulstruktur, observability og testløp. | `README.md` |
| 2025-09-28 | Flyttet frontendlogikk til typed hooks: Figma-adressesøk (`useFigmaAddressSearch`), energimerke-beregning (`useEnergyRatingEstimator`) og gul liste-status (`useGulListeStatus`). Utrensket lokale `console.log` og sentralisert BuildingApi-oppgaver. | `src/App.tsx`, `src/hooks/useFigmaAddressSearch.ts`, `src/hooks/useEnergyRatingEstimator.ts`, `src/hooks/useGulListeStatus.ts`, `src/components/{EnergyRatingEstimator,GulListeStatus}.tsx`, `src/services/buildingApi.ts` |
| 2025-09-28 | Standardiserte legacy-logger (scripts/utils), flyttet SOAP-debug til `debugLog` og rettet TEK-switch slik at `npm run lint` går grønt igjen. `npm run lint` kjørt | `api-server.js`, `korrekt-teigid.js`, `services/solar-service/index.js`, `services/subsidy-service/index.js`, `src/clients/adresseClient.ts`, `src/components/{AddressSearch.tsx,ErrorDisplay.tsx}`, `src/utils/{bygningstypeMapping.ts,soapDump.ts,tekEnergyCalculations.ts}` |
| 2025-09-28 | `npm run verify` grønn (typecheck, lint, kontrakttester). Forsøk på `npm run test:full-chain` feilet fordi script mangler i `package.json`; må gjenopprettes før neste løp. | `npm run verify`, `npm run test:full-chain` |
| 2025-09-28 | Gjenopprettet `npm run test:full-chain` (starter solar-, building-info- og API-tjenestene via `tsx`) og la til solkart-mock (`SOLAR_SERVICE_MOCK`). Kjøring i MacosSeatbelt feilet fordi sandbox blokkerer localhost-tilkoblinger; kjør lokalt uten sandbox for full verifikasjon. | `scripts/test-full-chain.ts`, `package.json`, `services/solar-service/index.js` |
| 2025-09-28 | `npm run test:full-chain -- --mock` kjørt lokalt (uten sandbox). Full kjede leverer gnr/bnr 130/136, byggeår 1892, bruksareal 280 m², solpotensial 796 157 kWh og filtrert solenergi 94 904 kWh. Tjenestene avslutter med exit code 0 etter testen (forventet). | `scripts/test-full-chain.ts`, `solinnstraling`-logg |

### Umiddelbare handlinger

- ✅ `packages/config` og dokumentendringene er allerede sjekket inn (ref. commit `cce23b9`); fortsett å stage nye filer før videre arbeid.
- ✅ Flat `eslint.config.js` er etablert og brukes av `npm run lint`, så lint-kontrollen er tilbake i Fase A-løpet.
- ✅ TypeScript-bruddene er håndtert – Figma-moduler/samples er ryddet eller ekskludert i `tsconfig`, og `npx tsc --noEmit` kjører grønt.
- ✅ Prometheus-metrikker for building-info-service er etablert (`/metrics`), og kontrakttestene dokumenterer navn/labels. Observability-handover (ServiceMonitor-utkast, dashboardidéer, alert-prinsipper) er beskrevet i dokumentasjonen til bruk for GitOps-teamet.
- ✅ `npm run verify` samler typecheck, lint og kontraktstester; GitHub Actions-workflow `Verify` kjører samme løp på push/PR (frontend-legacy gjenstår i lint-trinnet).

### Status (sist oppdatert 2025-09-29)

- building-info-service er splittet i tydelige moduler (`context`, `matrikkel`, `resultAssembler`) og `index.ts` eksponerer kun Express-skallet. Klientene bruker felles `MatrikkelContext` og `runPythonScript` erstatter hardkodet `python` i API-serveren.
- Frontend-adresseoppslag, energimerke-estimator og gul liste-status drives nå av typed hooks (`useFigmaAddressSearch`, `useEnergyRatingEstimator`, `useGulListeStatus`), med felles byggkategorier/TEK-data og oppdatert `BuildingApiService` for forslag.
- End-to-end typekontroll (`npx tsc --noEmit`) og `npm run lint` er grønne etter opprydding i legacy-scripts, utils og `tekEnergyCalculations`.
- Observability-krav fra Marvin er gjennomgått; applikasjonen leverer Prometheus-metrikker og dokumentasjon på navn/labels, mens GitOps-/driftsteamet følger opp ServiceMonitor, dashboards og alarmer når de etablerer Marvin-miljøet.
- `npm run verify` binder sammen `tsc --noEmit`, lint og kontraktstester lokalt; lint er nå grønn etter opprydding i legacy-scripts og verifiseres som del av full chain-kjøringen.
- `/metrics` eksponeres nå med Prometheus-metrikker for cache, lookup, eksterne kall og resultAssembler-kilder (`building_info_service_*`), og `npm run test:contract` kjører nye kontraktstester for matrikkel-lookup og resultAssembler.
- `Dokumentasjon/Utvikling/prometheus-metrikker.md` beskriver alle custom metrics, labels, ServiceMonitor-mal og kontrakttestene; oppdater filen ved endringer i observability-laget.
- Fase E er i gang: prodklar `Dockerfile`, `npm run build:backend` (esbuild) og `build:prod`-løpet er på plass; eksempelmanifester for Marvin (`deploy/marvin/`) er lagt til (SecretStore/ExternalSecret, Deployment, Service, ServiceMonitor, Argo Application/ApplicationSet). Gjenstående arbeid: konkretisere egress/Python-krav og ferdigstille GitOps-repo.

### Neste delmål

- Start parkert tiltak #1: skisser plan for å erstatte Enova-fallback i `useTiltakSubsidies` med reell datakilde, inkludert mapping og testløp.
- Beskriv hvordan `npm run build:backend` og relevant CI-jobb bør settes opp (parkert tiltak #2), slik at vi kan planlegge implementeringen i neste runde.
- Legg inn hurtig-test av Dockerimagen (lokal `docker run` + helsesjekk) og dokumenter expected env/porter som del av overleveringspakken.

### Fast testsekvens

**Fast testsekvens før og etter større refaktoreringer**

- `npm run verify` – kjører `tsc --noEmit`, lint og kontraktstester; brukes lokalt før commit og i GitHub Actions (lint feiler inntil legacy-områdene er ryddet/ekskludert).
- `npx tsc --noEmit` – kan fortsatt kjøres isolert for rask typekontroll.
- `npm run lint` – inngår i `npm run verify`, men kan kjøres isolert for målrettet opprydding; håndter legacy-områder separat.
- `LIVE=1 node --loader ts-node/esm scripts/test-known-addresses.ts` – validerer kjente adresser mot levende tjenester.
- `npm run test:full-chain` – spinner opp solar/building/API lokalt og bekrefter solenergi-data og matrikkeloppslag end-to-end (standard adresse `Grenseveien 99, 0663 Oslo`).
- `npm run test:contract` – kjører nye kontraktstester for matrikkel-lookup og resultAssembler-metrikkene med ts-node/tsx.
- Oppdater alltid dette dokumentet med status og funn etter gjennomførte oppgaver/tests før du går videre.

### Parkerte tiltak fra runde 1 (revurderes)

_Disse punktene ble notert i forrige forsøk og må bekreftes før de aktiveres i runde 2._

1. **Frontend API-integrasjon**

   - Erstatt midlertidige Enova-fallbacks i `useTiltakSubsidies` med ordentlig mapping mot spreadsheet/API og utvid tiltak-navn-normalisering
   - Kartlegg gjenværende mock-kall mot `http://localhost:3002` (Excel-backend) og skissér hvordan disse flyttes inn i `buildingApi` med typed responser
   - Når matrisen i Excel er ryddet, oppdater `stotteordningData`/normaliseringen slik at badge-navn og tekster kun kommer fra datakilden
2. **CI & bygg**

   - Legg til `npm run build:backend` og CI-jobb for `tsc`, `lint`, `build`
3. **Dokumentasjon & observability**

   - Oppdater README og GitOps-notater
   - Beskriv prom/alerting-oppsett + tracing-plan

### Legacy lint-opprydding

- **Backend (fase C):** ✅ Ferdig: building-info-moduler, proxy/server og tilhørende tjenester er ryddet for `console.log`, `any` og ubrukte `eslint-disable`.
- **Frontend (fase D):** Kjør lint/type-opprydding i `App.tsx`, `EnergyRatingEstimator.tsx`, `GulListeStatus.tsx` m.fl. parallelt med hook/tiltak-refaktor. Legg typarbeidet inn i oppgaven for å unngå dobbelrefaktorering.
- **Scripts/øvrige filer:** Legg midlertidige ESLint-overrides i `eslint.config.js` for frittstående scripts og dokumenter unntakene. Fjern override når fila enten er slettet eller ryddet.
- `npm run verify` brukes som eneste samlede sjekk – når lint er grønn for et område skal verify løpe uten ekstra lokale script.

## Arkiv – runde 1 (des 2024 – sep 2025)

### Arkivert refaktorplan (runde 1)

- Etabler grunnlag: dokumenter request-flow, kartlegg eksterne endepunkter, lag typed konfig-modul.
- Modulariser backend: `apps/backend`/dedikerte domene-tjenester, tynne HTTP-lag, interfaces.
- Strukturer data/caching: repository-klasser, asynkron init, cache-abstraksjon med metrikker.
- Harden integrasjoner: standard timeout/retry/proxy, typed SOAP-klienter, audit-logging.
- Sikre konfig/secrets: fjern `.env`-avhengighet i runtime, dokumenter ExternalSecret-oppsett.
- Forbered containerdrift: Dockerfile med ferdigkompilerte artefakter, ingen `ts-node` i prod.
- Dokumenter GitOps-strategi: `applications/`, `applicationsets/`, secrets-manifester, `targetRevision`.
- Restaurer frontend: API-hooks (React Query/SWR), del App i containere, isoler mock/test-data.
- Observability og operasjonell scaffolding: strukturert logger, health/readiness, metrikker, korrelasjons-ID.
- Refaktoreringens arbeidsflyt: feature-branch, refaktor-journal, PR-gate med lint/type/test.
- Kvalitetssikring: utvid test-suite (unit/contract/e2e), kjør alt i CI.
- Utvikleropplevelse: TypeScript-paths, fjerne ESM/CommonJS-miks, README med local vs Marvin modus, dataoppdateringsløp.

### Neste steg (plan)

1. Observability-lag
   - Pino-basert request-logging + korrelasjons-ID
   - Prometheus-metrikker (HTTP, eksterne kall, cache, feilrate) + `/metrics`
   - Dokumentasjon av logging/alerting i README
2. Konfig & kjernepakker
   - Flytt `server/config/runtime.ts` til `packages/config`
   - Etabler `packages/core-domain` (felles typer/interfaces)
3. CI / bygg
   - `npm run build:backend` (dist artefakt) + CI-jobb for type/lint/build
4. Dokumentasjon
   - Oppdater README og overleveringsnotater med ny backend-struktur og observability
5. Frontend/øvrig
   - Fortsett planlagt frontend-refaktor; isolér mock-data, flytt API-kall til hooks

### Arkivert refaktorlogg (runde 1)

| Dato       | Beskrivelse                                                                                                                                                                                                                                                    | Berørte filer                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-01-XX | Opprettet branch `refaktor`                                                                                                                                                                                                                                  | `git`                                                                                                                                                                                                                                                                                                                                                                     |
| 2025-01-XX | Oppdatert `loadEnv.ts` til å laste `.env` uten logging                                                                                                                                                                                                    | `loadEnv.ts`                                                                                                                                                                                                                                                                                                                                                              |
| 2025-01-XX | La til typed runtime-config `server/config/runtime.ts` med zod-validering; avviklet direkte `.env`-tilgang i building-info-service og API/proxy startskript                                                                                                | `server/config/runtime.ts`, `services/building-info-service/index.ts`, `server/index.ts`, `src/api-server.ts`, `scripts/start-ui-only.sh`                                                                                                                                                                                                                                 |
| 2025-01-XX | Installert `zod` og oppdatert avhengigheter                                                                                                                                                                                                                  | `package.json`, `package-lock.json`                                                                                                                                                                                                                                                                                                                                     |
| 2025-01-XX | Migrerte SOAP-klienter (Bygning, Matrikkel, Store, Adresse) til runtimeConfig og fjernet `loadEnv`-importer                                                                                                                                                  | `src/clients/BygningClient.ts`, `src/clients/MatrikkelClient.ts`, `src/clients/StoreClient.ts`, `src/clients/adresseClient.ts`                                                                                                                                                                                                                                      |
| 2025-01-XX | La til flat ESLint-konfig og `typescript-eslint`, `eslint-plugin-react`                                                                                                                                                                                    | `eslint.config.js`, `package.json`                                                                                                                                                                                                                                                                                                                                      |
| 2025-09-19 | Scripts laster nå miljø via `server/config/runtime.ts`; fjernet legacy `loadEnv.ts`                                                                                                                                                                      | `scripts/*.ts`, `loadEnv.ts`                                                                                                                                                                                                                                                                                                                                            |
| 2025-09-19 | Trukket ut `tsconfig.base.json`, laget `tsconfig.scripts.json`, og justert ESLint for å ignorere legacy/Figma-sone                                                                                                                                        | `tsconfig*.json`, `eslint.config.js`                                                                                                                                                                                                                                                                                                                                    |
| 2025-09-19 | Ryddet TypeScript-feil i klienter/hooks/tjenester;`npx tsc --noEmit` kjører grønt                                                                                                                                                                          | `src/clients/BruksenhetClient.ts`, `src/clients/BygningClient.ts`, `src/clients/MatrikkelClient.ts`, `src/hooks/useMatrikkelenheter.ts`, `src/services/gul-liste-service.ts`, `src/services/solarEnergyService.ts`                                                                                                                                              |
| 2025-09-19 | Reinstallerte npm-avhengigheter og kjørte `LIVE=1 scripts/test-known-addresses.ts`; bekreftet `Grenseveien 99` m/energiattest, andre adresser feilet på geonorge/bygg-tilknytning                                                                        | `package-lock.json`, `node_modules/`, `scripts/test-known-addresses.ts`                                                                                                                                                                                                                                                                                               |
| 2025-09-19 | La til `scripts/test-full-chain.ts` og npm-script `test:full-chain` for full dataflyt (API + building-info + solar); skal kjøres ved hver større refaktorering                                                                                           | `scripts/test-full-chain.ts`, `package.json`                                                                                                                                                                                                                                                                                                                            |
| 2025-09-19 | Ryddet ESLint-brudd i klienter/hooks/tjenester og frontend-debug-komponenter;`npm run lint` + `npm run test:full-chain` kjørt etter endringer                                                                                                             | `src/components/DebugDataTable.tsx`, `src/components/ErrorDisplay.tsx`, `src/hooks/useBuildingInfo.ts`, `src/services/buildingApi.ts`, `src/services/csvService.ts`, `src/services/gul-liste-integration.ts`, `src/services/solarEnergyService.ts`, `src/services/stotteordning-service.ts`, `src/types/House.ts`, `src/utils/tekEnergyCalculations.ts` |
| 2025-09-19 | `npm run build` bekreftet grønn (Vite prod-build); re-kjørte `npm run test:full-chain` etter oppdateringene                                                                                                                                              | `src/services/solarEnergyService.ts`, `dist/`                                                                                                                                                                                                                                                                                                                           |
| 2025-09-19 | Ekstraherte Geonorge-, Enova- og soldata-hjelpere til `services/building-info-service/lib/*`; oppdatert hovedtjenesten og kjørte `npm run lint` + `npm run test:full-chain`                                                                             | `services/building-info-service/index.ts`, `services/building-info-service/lib/{geoLookup,energiattest,solar}.ts`                                                                                                                                                                                                                                                       |
| 2025-09-19 | Flyttet robust bygg-/bruksenhetsvalg til `lib/buildingSelection.ts`; hovedtjenesten bruker nå helper og alle tester kjørt (`npm run lint`, `npm run test:full-chain`)                                                                                  | `services/building-info-service/index.ts`, `services/building-info-service/lib/buildingSelection.ts`                                                                                                                                                                                                                                                                    |
| 2025-09-19 | Trakk ut resultat-/CSV-sammensettingen til `lib/resultAssembler.ts`; `npx tsc --noEmit` og `npm run lint` kjørt grønt                                                                                                                                  | `services/building-info-service/index.ts`, `services/building-info-service/lib/resultAssembler.ts`                                                                                                                                                                                                                                                                      |
| 2025-09-19 | La til mock-støtte i solar-service (`SOLAR_SERVICE_MOCK=1`) og oppdatert test-skript med `--mock`-flagg for å trigge mockdata ved behov                                                                                                                  | `services/solar-service/index.js`, `scripts/test-full-chain.ts`                                                                                                                                                                                                                                                                                                         |
| 2025-09-19 | Ekstraherte matrikkel-/byggoppslag til `lib/matrikkelResolver.ts`; `npm run lint`, `npx tsc --noEmit`, `npm run test:full-chain` (live) kjørt                                                                                                         | `services/building-info-service/index.ts`, `services/building-info-service/lib/matrikkelResolver.ts`                                                                                                                                                                                                                                                                    |
| 2025-09-19 | Oppdatert README med målstruktur for arkitektur, drift og testløype (`README.md` er nå referansemålet for modul-/kodearkitektur; denne filen skal speile eventuelle avvik/justeringer fortløpende)                                                      | `README.md`                                                                                                                                                                                                                                                                                                                                                               |
| 2025-09-19 | Skilt ut HTTP/Express-laget i building-info-service til `http/app.ts` for å forberede `apps/backend`; `npx tsc --noEmit`, `npm run lint` kjørt                                                                                                       | `services/building-info-service/index.ts`, `services/building-info-service/http/app.ts`                                                                                                                                                                                                                                                                                 |
| 2025-09-20 | Flyttet felles `describeError` + Matrikkel-kontekstfabrikk til `packages/core-domain`; forbedret `.env`-lasting i `runtimeConfig`; `npx tsc --noEmit`, `npm run lint` kjørt                                                                       | `packages/core-domain/src/{errors.ts,matrikkelContext.ts,index.ts}`, `services/building-info-service/service.ts`, `services/building-info-service/index.ts`, `apps/backend/src/{app.ts,routes/api.ts}`, `packages/config/runtime.ts`                                                                                                                              |
| 2025-09-19 | Etablert `apps/backend` med egen Express-app som mount’er building-info via modulene; `npx tsc --noEmit`, `npm run lint` kjørt                                                                                                                         | `apps/backend/src/{app.ts,index.ts}`, `services/building-info-service/service.ts`, `package.json`                                                                                                                                                                                                                                                                     |
| 2025-09-19 | Migrerte tidligere `src/api-server.ts`-endepunkter (address-lookup, energiattest, støtteordning, Geonorge-proxy) til backend-router og oppdatert `npm run dev` til å bruke `dev:backend`; `npx tsc --noEmit`, `npm run lint` kjørt                | `apps/backend/src/routes/api.ts`, `apps/backend/src/app.ts`, `package.json`                                                                                                                                                                                                                                                                                           |
| 2025-09-19 | Fjernet legacy `server/index.ts` og `src/api-server.ts`; oppdatert start-skript (`start-ui-only.*`) og dokumentasjon til å peke på `apps/backend/src/index.ts`; `npx tsc --noEmit`, `npm run lint` kjørt                                        | `scripts/start-ui-only.sh`, `start-ui-only.bat`, `UI-MOCKUP-README.md`, `package.json`                                                                                                                                                                                                                                                                                      |
| 2025-09-19 | Etablert observability-lag (Pino-requestlogger med korrelasjons-ID, Prometheus-metrikker på `/metrics`, cache-hit/miss & eksterne kall); `npx tsc --noEmit`, `npm run lint` kjørt                                                                      | `packages/observability/{logger.ts,metrics.ts}`, `apps/backend/src/{app.ts,index.ts}`, `apps/backend/src/routes/{api.ts,matrikkelProxy.ts}`, `package.json`                                                                                                                                                                                                         |
| 2025-09-19 | Flyttet runtime-konfig til `packages/config/runtime.ts` og etablert `packages/core-domain` (GeoAddress, BuildingDataResult, MatrikkelContext m.m.); refaktorert klienter/servicer til å bruke felles typer; `npx tsc --noEmit`, `npm run lint` kjørt | `packages/{config,core-domain}`, `services/building-info-service/**`, `src/clients/**`, `scripts/**`, `package.json`                                                                                                                                                                                                                                              |
| 2025-09-20 | Frontend bruker nå typed backend-kontrakter (`AddressLookupResponse`, `AddressSuggestion`); `buildingApi` sentraliserer `/api`-kall og autocomplete-bug er fikset; `npx tsc --noEmit`, `npm run lint` kjørt                                      | `packages/core-domain/src/{types.ts,index.ts}`, `src/services/buildingApi.ts`, `src/hooks/useBuildingInfo.ts`, `src/components/{AddressSearch.tsx,ResultsTable.tsx,EnergyRatingEstimator.tsx}`, `src/App.tsx`                                                                                                                                                     |
| 2025-09-20 | Renset frontend for direkte `/api`-`fetch` (støtteordninger, gul liste, energimerke) og rutet alt via `buildingApi`/`stotteordning-service`; Figma-tiltakskomponenter gjenbruker nå felles service                                                   | `src/services/{stotteordning-service.ts,buildingApi.ts}`, `src/components/GulListeStatus.tsx`, `src/components/EnergyRatingCalculator.tsx`, `src/components/FigmaBlokk/components/Tiltak/**/*.tsx`                                                                                                                                                                  |
| 2025-09-21 | Innførte SWR-hooks for adresseoppslag, energimerke, gul liste og støtteordninger; refaktorerte App og delte komponenter til å bruke nye hooks; la til global SWRConfig                                                                                      | `src/hooks/api/**/*`, `src/hooks/useBuildingInfo.ts`, `src/components/{GulListeStatus.tsx,EnergyRatingCalculator.tsx}`, `src/App.tsx`, `src/main.tsx`                                                                                                                                                                                                             |
| 2025-09-21 | Flyttet WizardFlow-subisidier til StotteordningService/SWR; la til `useTiltakSubsidies` og Enova-beløpsfallback                                                                                                                                             | `src/hooks/api/useTiltakSubsidies.ts`, `src/services/stotteordning-service.ts`, `src/App.tsx`                                                                                                                                                                                                                                                                         |
| 2025-09-21 | Normaliserte støtteordningsnavn/forvalter (Oppgradering av bygningskropp → Enova, fjernet `                                                                                                                                                                  | Enova`-suffikser)                                                                                                                                                                                                                                                                                                                                                           |
| 2025-09-22 | Fjernet Enova-fallback, utvidet tiltak- og bygningstype-normalisering, slått sammen gulliste-/ikke_gulliste-data i fallback og hardenet buildingApi for Node-kjøring;`npx tsc --noEmit`, `npm run lint` kjørt                                           | `apps/backend/src/routes/api.ts`, `src/services/stotteordning-service.ts`, `src/services/buildingApi.ts`                                                                                                                                                                                                                                                              |
| 2025-09-22 | Generering av støtteordningscache skjer nå via `stotteordning_cache.py` (zip-parser) og `npm run generate:stotteordninger` kjøres før build; `npm run generate:stotteordninger`, `npx tsc --noEmit`, `npm run lint` kjørt                       | `stotteordning_cache.py`, `stotteordninger_data.json`, `src/data/stotteordningData.js`, `scripts/generate-stotteordninger.mjs`, `package.json`, `README.md`                                                                                                                                                                                                     |

### Observasjoner & status

- `npm run lint` (2025-09-19) går grønt etter opprydding i SOAP-klienter, API-hjelpere og debug-komponenter.
- 2025-09-19: `npx tsc --noEmit` og `npm run lint` kjørt på nytt etter `resultAssembler`-refaktoren (ingen avvik).
- 2025-09-19: Testløpet gjentatt (`npx tsc --noEmit`, `npm run lint`), begge grønne; `npm run test:full-chain` feilet i sandbox pga. port-binding for solar-service (forventet). Kjør lokalt uten sandbox eller bruk `--mock`.
- 2025-09-19: `npx tsc --noEmit` og `npm run lint` kjørt på nytt etter `resultAssembler`-refaktoren (ingen avvik).
- `npm run test:full-chain` feiler i sandbox (klarer ikke starte lokal `solar-service` pga port-restriksjoner). Lokalt kjører testen mot live solkart som default; legg til `--mock` (eller sett `SOLAR_SERVICE_MOCK=1`) hvis du vil bruke mockdata.
- `npx tsc --noEmit` kjører grønt etter opprydding i SOAP-klientene/hooks; `npm run build` (2025-09-19) går også igjennom.
- `LIVE=1 scripts/test-known-addresses.ts` verifiserte produktløpet; `Grenseveien 99, 0663 Oslo` leverte energiattest, mens flere eldre adresser mangler bygg/Geonorge-treff (følg opp hvis de skal støttes).
- `npm run test:full-chain` (starter solar-, building- og API-tjenestene) skal kjøres som del av refaktor-testløpet; bekrefter solenergi-data og adresseoppslag mot hele kjeden med standard testadresse. Siste kjøringer (2025-09-19) ga GNR/BNR 130/136, solenergi 796 158 kWh/år og energiattest tilgjengelig.
- ✅ Autocomplete i adressefeltet fungerer igjen via `/api/address-suggestions`; oppdater testdekning ved videre frontend-refaktorering.
- 2025-09-20: Frontend-kall for støtteordninger, energimerke og gul liste går nå via `buildingApi`; Figma-moduler er ryddet for hardkodede `/api`-URLer.
- 2025-09-21: `npx tsc --noEmit` og `npm run lint` kjørt etter SWR-hook-refaktoreringen (ingen avvik).
- 2025-09-21: WizardFlow henter Enova-støtte via `useTiltakSubsidies`; fallback-map beholdt for Loftisolering/varmepumpe mens vi venter på ekte datakilde.
- 2025-09-21: Navn og forvaltere for støtteordninger normaliseres nå (fjerner `| Enova`-suffiks og sørger for at Oppgradering av bygningskropp vises som Enova).
- 2025-09-20: Core-domain inneholder nå delte feilbeskrivelser og Matrikkel-kontekstfabrikk; `runtimeConfig` prioriterer `DOTENV_CONFIG_PATH`, `.env.local`, deretter `.env`. `npx tsc --noEmit`, `npm run lint` kjørt.
- 2025-09-20: Frontend-kall mot `/api/address-lookup` og `/api/address-suggestions` rutes via `buildingApi`; autocomplete fungerer igjen i både App og Figma-modus. `npx tsc --noEmit`, `npm run lint` kjørt.
- Building selection og bruksenhetslogikk er flyttet til `lib/buildingSelection.ts`, slik at resten av tjenesten blir tynnere og enklere å teste.
- Legacy `loadEnv.ts` er fjernet; scripts importerer `runtimeConfig` for lokal kjøring.
- Backend eksponerer nå `/metrics` (Prometheus) og bruker Pino-basert request-logging med `x-request-id` korrelasjons-ID.
- Nye metrikker: `building_info_service_lookup_requests_total`, `building_info_service_external_requests_total`, `building_info_service_resultassembler_{bruksareal,byggeaar}_source_total`, `building_info_service_resultassembler_solar_presence_total` m.fl. (se `/metrics` for labels/service-navn).
- `Overlevering/Marvin-tilpasning.md` ble integrert her; filen kan slettes eller peke hit.
- 2025-09-23: FigmaMainScript/EnergySolutionButtons/WhiteInfoBox er tilbake i `tsconfig`; `npx tsc --noEmit` holder grønn. `npm run lint` stopper fremdeles med eksisterende console-logger/`any` i Tiltak-mappene – ryddes i neste Figma-pulje.
- 2025-09-23: building-info-service delt i `context.ts`, `matrikkel.ts` og `resultAssembler.ts`; `resolveBuildingData` i `index.ts` re-eksponeres via modulene. `npx tsc --noEmit` kjørt etter oppsplitting.

## Test-konsolidering (2025-12)

### For
- 70+ testfiler i `scripts/`
- Mange duplikater og overlappende tester
- 5 .cjs-filer
- Ingen strukturert test-suite

### Etter
- Strukturert `tests/`-hierarki (unit, integration, e2e, fixtures)
- ~15 konsoliderte testfiler
- Alle tester i TypeScript
- Klare test-scripts i package.json

### Gevinster
- Redusert vedlikeholdsbyrde (70+ til ~25 filer)
- Tydelig teststruktur med klare kategorier
- Enklere a kjore spesifikke testgrupper
- Konsistent TypeScript-bruk

### Nye test-kommandoer
```bash
npm run test:unit          # Enhetstester
npm run test:integration   # Integrasjonstester (LIVE=1)
npm run test:e2e           # E2E-tester (LIVE=1)
npm run test:all           # Alle nye tester
npm run test:watch         # Watch mode
```

### Beholdte scripts
- `test-contract-matrikkel.ts` - Kontrakttester med nock-mocking
- `test-contract-resultAssembler.ts` - Kontrakttester med nock-mocking
- `test-full-chain.ts` - E2E-test som spawner tjenester
- `test-api-smoke.ts` - Smoke-test mot live API

Se `tests/README.md` for fullstendig dokumentasjon av teststrukturen.

## GRANTS_MIGRATION (2025-12)

### Bakgrunn
Støtteordning-systemet hadde to parallelle implementasjoner:
- **Legacy:** Excel → Python → JavaScript (1800+ linjer autogenerert kode)
- **Grants:** JSON-basert tilskudd-katalog med strukturert innhold

### Gjennomført migrering
**Dato:** 2025-12-11

**Fjernet:**
- `src/data/stotteordningData.js` (1818 linjer)
- 5 Python-skript i `scripts/python/` (stotteordning_cache.py, hent_stotteordninger_*.py)
- 3 API-endepunkter i `src/api-server.ts` (/api/stotteordninger, /api/stotteordninger-live, /api/update-stotteordninger)
- `useStotteordninger` legacy-hook i `shared.ts` (~70 linjer)
- `StotteordningService` klasse i `src/services/stotteordning-service.ts` (113 linjer)
- Miljøvariabler: VITE_FORCE_LEGACY_GRANTS, VITE_MIN_GRANT_COUNT, VITE_DEBUG_GRANTS

**Forenklet:**
- `useGrantAwareStotteordninger` hook: ~240 → ~100 linjer (fjernet fallback-logikk)
- Alle 8 tiltak-komponenter: fjernet `legacyTiltakSlug`-parameter

**Gevinst:**
- ~2100 linjer kode fjernet
- Ingen Python-avhengigheter for støtteordninger
- Enklere vedlikehold (én datakilde)
- Bedre type-sikkerhet (Zod-validert JSON vs. autogenerert JS)

### Ny arkitektur
```
content/tiltak/*.json (grants: ["grant-id-1", "grant-id-2"])
         ↓
useGrantAwareStotteordninger (kun grants-basert)
         ↓
useTilskuddBatch (SWR-cache)
         ↓
content/tilskudd/*.json (strukturert tilskudd-innhold)
```

### Verifisering
- ✅ Alle 8 tiltak har grants definert
- ✅ Gul liste-varianter har audience-spesifikke grants
- ✅ Støtteordninger vises korrekt i UI
- ✅ Ingen console-errors relatert til støtteordninger
- ✅ `npm run build` passerer

## Solar-service TypeScript-migrering (2025-12)

### Endringer
- Konvertert `services/solar-service/index.js` (873 linjer) til TypeScript
- Lagt til 15+ type-definisjoner i `types.ts` for WFS, takflater, API-kontrakter, og interne strukturer
- Implementert strukturert logging med `[solar-service]`-prefiks (info, error, debug)
- Refaktorert konfigurasjon til type-sikker `loadConfig()`-funksjon
- Oppdatert `scripts/build-backend.mjs` og `package.json` til `.ts`-referanser

### Type-definisjoner (types.ts)
- `SolarServiceConfig` – Alle miljøvariabler og konfigurasjon
- `Takflate` – Takflate fra WFS med tak_id, bygg_id, bygg_nr, area_m2, irr_kwh_m2_yr, kWh_tot
- `ProjectedPoint` – UTM32-koordinater (east, north)
- `AdridLookupResult` – ADRID-oppslag med punkt
- `SolarQueryParams` / `SolarApiResponse` / `SolarErrorResponse` – API-kontrakt
- `DeltaAttempt` / `CollectTakflaterResult` / `BuildingGroupSelection` / `SurfaceMetrics` – Interne strukturer
- `WfsFeature` / `WfsFeatureCollection` / `WfsFeatureMember` – WFS/GML-parsing

### Bevart funksjonalitet
- ✅ Alle fire søkemodi (BYGG_ID, polygon, matrikkel, lat/lon)
- ✅ Delta-strategi med auto-ekspansjon (1→3→5→8→12→18→25m)
- ✅ ADRID-oppslag og fallback-logikk
- ✅ Bygningsnummer-hydration via `hydrateBuildingSurfaces()`
- ✅ Caching med NodeCache
- ✅ Mock-modus for testing (`SOLAR_SERVICE_MOCK=1`)
- ✅ API-kontrakt (validert mot `solar-validation.test.ts`)

### Validering
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Integrasjonstester: `npm run test:integration`
- Full-chain test: `npm run test:full-chain`
- Kontrakttester: `npm run test:contract`

### Teknisk gjeld fjernet
- ❌ JavaScript i services-mappen (solar-service var siste)
- ❌ Ustrukturert logging med `console.log`
- ❌ Manglende type-sikkerhet for WFS-parsing

### Berørte filer
| Fil | Endring |
|-----|---------|
| `services/solar-service/index.js` | Slettet |
| `services/solar-service/index.ts` | **NY** – TypeScript-versjon |
| `services/solar-service/types.ts` | **NY** – Type-definisjoner |
| `scripts/build-backend.mjs` | Oppdatert til `.ts`-referanse |
| `package.json` | Oppdatert `dev:solar` og `start:solar-service` |

## Subsidy-service fjerning (2025-12)

### Bakgrunn
`subsidy-service` var en 30-linjers PoC-stub opprettet for å demonstrere Enova-støtte-integrasjon. Tjenesten returnerte hardkodede støttebeløp basert på tiltak-navn og var aldri integrert i applikasjonen. Grants-migreringen (2025-12-11) har fullstendig erstattet behovet for denne tjenesten.

### Verifisering av ubrukt kode
**Dato:** 2025-12-11

**Grep-søk bekreftet:**
- ✅ Ingen HTTP-kall til `/subsidy`-endepunktet i `src/`, `services/`, eller `scripts/`
- ✅ Ingen imports av `subsidy-service` i applikasjonskode
- ✅ Ingen referanser til `localhost:4001` i kode (kun i Vite-proxy)

### Fjernet
- `services/subsidy-service/` (hele mappen, 30 linjer kode)
- npm-scripts: `dev:subsidy` i `package.json`
- Oppdatert `dev:local` script til å ikke inkludere subsidy
- Vite dev-proxy for `/subsidy` i `vite.config.ts`
- Dokumentasjonsreferanser i `README.md`

### Gevinst
- Redusert forvirring (én mindre ubrukt tjeneste)
- Enklere onboarding (færre services å forstå)
- Mindre vedlikeholdsbyrde
- Konsistent arkitektur (grants-basert støtteordning-system)

### Validering
- ✅ `npm run typecheck` – ingen type-feil
- ✅ `npm run lint` – ingen lint-advarsler
- ✅ `npm run test:contract` – kontrakttester passerer
- ✅ `npm run test:full-chain` – E2E-test passerer
- ✅ `npm run dev` – alle tjenester starter uten feil

### Berørte filer
| Fil | Endring |
|-----|---------|
| `services/subsidy-service/` | **SLETTET** – Hele mappen |
| `package.json` | Fjernet `dev:subsidy`, oppdatert `dev:local` |
| `vite.config.ts` | Fjernet `/subsidy`-proxy |
| `README.md` | Fjernet subsidy-service referanser |
| `Dokumentasjon/Utvikling/refaktor-oversikt.md` | Dokumentert fjerning |

## TILTAK_COMPONENT_CONSOLIDATION (Desember 2024)

### Bakgrunn
Kodebasen hadde 16 tiltak-komponenter (8 standard + 8 Gul-varianter) med en `legacyComponents.ts` mapping-fil. Gul-variantene var kun 10-linjers wrappers som sendte `audience="gulliste"` til hovedkomponenten.

### Endringer
- ✅ Oppdatert `TiltakComponentProps` til å inkludere `audience?: ContentAudience`
- ✅ Alle 8 hovedkomponenter aksepterer nå `audience`-prop direkte
- ✅ Fjernet 8 Gul-wrapper-filer fra `GulListeTiltak/`
- ✅ Slettet `legacyComponents.ts` mapping-fil
- ✅ Oppdatert `WhiteInfoBox.tsx` til direkte komponent-mapping
- ✅ Slettet `GulListeTiltak/`-mappen

### Gevinster
- **Redusert kompleksitet:** 16 → 8 komponenter (-50%)
- **Enklere imports:** Kun én komponent per tiltak
- **Eksplisitt audience-håndtering:** `audience`-prop synlig i alle brukspunkter
- **Bedre vedlikeholdbarhet:** Én kilde til sannhet per tiltak

### Migrering
Eksisterende kode som bruker Gul-komponenter må oppdateres:
```typescript
// Før:
import { VarmepumpeGul } from './Tiltak';
<VarmepumpeGul {...props} />

// Etter:
import { Varmepumpe } from './Tiltak';
<Varmepumpe {...props} audience="gulliste" />
```

### Validering
- ✅ Typecheck: `npm run typecheck`
- ✅ Lint: `npm run lint`
- ✅ Build: `npm run build`
- ✅ Manuell testing: WhiteInfoBox, PreviewPanel, MobileTiltakDetail

### Berørte filer
| Fil | Endring |
|-----|---------|
| `src/components/FigmaBlokk/components/Tiltak/shared.ts` | Lagt til `audience?: ContentAudience` i `TiltakComponentProps` |
| `src/components/FigmaBlokk/components/Tiltak/*.tsx` | Oppdatert wrapper til å akseptere `audience`-prop |
| `src/components/FigmaBlokk/components/Tiltak/index.tsx` | Fjernet Gul-komponent exports |
| `src/components/FigmaBlokk/components/Tiltak/GulListeTiltak/` | **SLETTET** – Hele mappen |
| `src/components/FigmaBlokk/components/Tiltak/legacyComponents.ts` | **SLETTET** |
| `src/components/FigmaBlokk/components/WhiteInfoBox.tsx` | Direkte komponent-mapping med `TILTAK_COMPONENT_MAP` |

## LOGGING_AND_CLEANUP_PHASE7 (Desember 2024)

### Bakgrunn
Kodebasen hadde inkonsistent logging med rå `console.log/warn/error`-kall spredt over 30+ filer, ingen sentral logging-utility, og deprecated funksjoner i `shared.ts` som ikke lenger var i bruk. Dette gjorde debugging vanskelig og skapte teknisk gjeld.

### Endringer

#### Strukturert logging
- ✅ Opprettet `services/shared/logger.ts` og `src/utils/logger.ts` med `createLogger()`-factory
- ✅ Migrert alle backend-services til strukturert logging med prefiks (e.g., `[building-info]`, `[solar-service]`)
- ✅ Migrert alle frontend-services og komponenter til strukturert logging
- ✅ Oppdatert `packages/config/src/runtime.ts` med nye debug-flags (`debugBuildingInfo`, `debugApi`, `debugBygningstype`)
- ✅ Beholdt miljøvariabel-kontroll for debug-logging (`DEBUG_BUILDING_INFO=1`, `API_DEBUG=1`, etc.)

#### Deprecated patterns cleanup
- ✅ Fjernet `getOverskriftColor()` og `OVERSKRIFT_FARGER` fra `shared.ts` (ingen referanser)
- ✅ Beholdt `LEGACY_OVERSKRIFT_FARGER` som **støttet intern fallback** i `useProviderColors()` – se begrunnelse nedenfor
- ✅ Slettet `fordelsbokser.tsx` (tom placeholder uten referanser)

#### LEGACY_OVERSKRIFT_FARGER – begrunnelse for bevaring
`LEGACY_OVERSKRIFT_FARGER` i `src/components/FigmaBlokk/components/Tiltak/shared.ts` er **bevisst beholdt** som en støttet intern fallback-mekanisme. Begrunnelsen:

1. **Bakoverkompatibilitet med eksterne datakilder:** Noen tilbydernavn kan komme fra eksterne API-er eller eldre datasett som ikke er oppdatert til å matche dictionary-navnene
2. **Graceful degradation:** Hvis dictionary-oppslaget feiler eller returnerer tomme verdier, sikrer legacy-mappingen at UI-et fortsatt viser riktige farger
3. **Ikke eksportert:** Konstanten er privat til modulen og brukes kun internt av `useProviderColors()` hook – den er ikke del av det offentlige API-et

**Fremtidig fjerning:** Kan vurderes når alle kjente eksterne datakilder er verifisert å bruke dictionary-navnene. Inntil da skal legacy-fallback beholdes for stabilitet.

### Gevinster
- **Konsistent logging:** Alle services bruker samme pattern med prefix og miljøvariabel-kontroll
- **Enklere debugging:** Strukturerte prefiks gjør det lett å filtrere logger per service
- **Redusert teknisk gjeld:** Fjernet ~50 linjer deprecated kode og 1 ubrukt fil
- **Bedre observability:** Logging-pattern klar for fremtidig integrasjon med Prometheus/Loki

### Miljøvariabler for debug-logging
| Variabel | Scope | Beskrivelse |
|----------|-------|-------------|
| `LOG_SOAP=1` | Backend | Aktiverer SOAP XML-logging i matrikkel-klienter |
| `DEBUG_BUILDING_INFO=1` | building-info-service | Detaljert logging av bygningsvalg-logikk |
| `API_DEBUG=1` | api-server | Debug-logging for API-forespørsler |
| `DEBUG_BYGNINGSTYPE=1` | StoreClient | Logging av bygningstype-mapping |

### Berørte filer (strukturert logging)
| Fil | Endring |
|-----|---------|
| `services/shared/logger.ts` | **NY** – Sentral logger-factory for backend |
| `src/utils/logger.ts` | **NY** – Sentral logger-factory for frontend |
| `services/building-info-service/logging.ts` | Refaktorert til å bruke `createLogger()` |
| `services/solar-service/index.ts` | Erstattet inline `infoLog` med logger |
| `services/admin-server/index.ts` | Erstattet `console.warn` med logger |
| `services/admin-api/*.ts` | Erstattet alle `console.*` med logger (6 filer) |
| `src/api-server.ts` | Erstattet alle `console.*` med logger |
| `src/utils/soapDump.ts`, `src/utils/bygningstypeMapping.ts` | Refaktorert til `createLogger()` |
| `src/clients/StoreClient.ts` | Erstattet `console.warn` med logger (debug-only) |
| `server/index.ts` | Erstattet `console.error` med logger |

### Berørte filer (cleanup)
| Fil | Endring |
|-----|---------|
| `src/components/FigmaBlokk/components/Tiltak/shared.ts` | Fjernet `getOverskriftColor()` og `OVERSKRIFT_FARGER` eksport |
| `src/components/FigmaBlokk/components/Tiltak/fordelsbokser.tsx` | **SLETTET** – Ubrukt placeholder |

### Validering
- ✅ Typecheck: `npm run typecheck`
- ✅ Lint: `npm run lint`
- ✅ Kontrakttester: `npm run test:contract`
- ✅ Full-chain test: `npm run test:full-chain`

### Notater
- Scripts i `scripts/` og tester i `tests/` beholder `console.log` for CLI-output (ikke produksjonskode)
- Global error handlers i `server/index.ts` og `services/admin-api/index.ts` bruker logger for konsistens
- Dev-only logging beholder `if (isDev)` guard i tillegg til logger der det er relevant
