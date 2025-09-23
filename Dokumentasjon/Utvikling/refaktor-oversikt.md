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
| 2025-09-28 | Oppdaterte dokumentasjonen for adresseoppslag: README beskriver modulstruktur/observability og `Overlevering/README.md` peker på samme innhold. | `Dokumentasjon/Utvikling/README.md`, `Overlevering/README.md` |
| 2025-09-28 | Flyttet frontendlogikk til typed hooks: Figma-adressesøk (`useFigmaAddressSearch`), energimerke-beregning (`useEnergyRatingEstimator`) og gul liste-status (`useGulListeStatus`). Utrensket lokale `console.log` og sentralisert BuildingApi-oppgaver. | `src/App.tsx`, `src/hooks/useFigmaAddressSearch.ts`, `src/hooks/useEnergyRatingEstimator.ts`, `src/hooks/useGulListeStatus.ts`, `src/components/{EnergyRatingEstimator,GulListeStatus}.tsx`, `src/services/buildingApi.ts` |
| 2025-09-28 | Standardiserte legacy-logger (scripts/utils), flyttet SOAP-debug til `debugLog` og rettet TEK-switch slik at `npm run lint` går grønt igjen. `npm run lint` kjørt | `api-server.js`, `korrekt-teigid.js`, `services/solar-service/index.js`, `services/subsidy-service/index.js`, `src/clients/adresseClient.ts`, `src/components/{AddressSearch.tsx,ErrorDisplay.tsx}`, `src/utils/{bygningstypeMapping.ts,soapDump.ts,tekEnergyCalculations.ts}` |
| 2025-09-28 | `npm run verify` grønn (typecheck, lint, kontrakttester). Forsøk på `npm run test:full-chain` feilet fordi script mangler i `package.json`; må gjenopprettes før neste løp. | `npm run verify`, `npm run test:full-chain` |

### Umiddelbare handlinger

- ✅ `packages/config` og dokumentendringene er allerede sjekket inn (ref. commit `cce23b9`); fortsett å stage nye filer før videre arbeid.
- ✅ Flat `eslint.config.js` er etablert og brukes av `npm run lint`, så lint-kontrollen er tilbake i Fase A-løpet.
- ✅ TypeScript-bruddene er håndtert – Figma-moduler/samples er ryddet eller ekskludert i `tsconfig`, og `npx tsc --noEmit` kjører grønt.
- ✅ Prometheus-metrikker for building-info-service er etablert (`/metrics`), og kontrakttestene dokumenterer navn/labels. Observability-handover (ServiceMonitor-utkast, dashboardidéer, alert-prinsipper) er beskrevet i dokumentasjonen til bruk for GitOps-teamet.
- ✅ `npm run verify` samler typecheck, lint og kontraktstester; GitHub Actions-workflow `Verify` kjører samme løp på push/PR (frontend-legacy gjenstår i lint-trinnet).

### Status (sist oppdatert 2025-09-28)

- building-info-service er splittet i tydelige moduler (`context`, `matrikkel`, `resultAssembler`) og `index.ts` eksponerer kun Express-skallet. Klientene bruker felles `MatrikkelContext` og `runPythonScript` erstatter hardkodet `python` i API-serveren.
- Frontend-adresseoppslag, energimerke-estimator og gul liste-status drives nå av typed hooks (`useFigmaAddressSearch`, `useEnergyRatingEstimator`, `useGulListeStatus`), med felles byggkategorier/TEK-data og oppdatert `BuildingApiService` for forslag.
- End-to-end typekontroll (`npx tsc --noEmit`) og `npm run lint` er grønne etter opprydding i legacy-scripts, utils og `tekEnergyCalculations`.
- Observability-krav fra Marvin er gjennomgått; applikasjonen leverer Prometheus-metrikker og dokumentasjon på navn/labels, mens GitOps-/driftsteamet følger opp ServiceMonitor, dashboards og alarmer når de etablerer Marvin-miljøet.
- `npm run verify` binder sammen `tsc --noEmit`, lint og kontraktstester lokalt; lint-blokkeringen fra gamle loggere er fjernet, og verify-løpet er klart når frontend-hookdokumentasjon er på plass.
- `/metrics` eksponeres nå med Prometheus-metrikker for cache, lookup, eksterne kall og resultAssembler-kilder (`building_info_service_*`), og `npm run test:contract` kjører nye kontraktstester for matrikkel-lookup og resultAssembler.
- `Dokumentasjon/Utvikling/prometheus-metrikker.md` beskriver alle custom metrics, labels, ServiceMonitor-mal og kontrakttestene; oppdater filen ved endringer i observability-laget.

### Neste delmål

- Planlegg full verify-håndtering: gjenopprett `npm run test:full-chain`-scriptet (mangler i `package.json`) og logg nytt testrun når scriptet er på plass.

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

   - Oppdater `Overlevering/README.md`, README, GitOps-notater
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
   - Oppdater `Overlevering/README.md` + README med ny backend-struktur og observability
5. Frontend/øvrig
   - Fortsett planlagt frontend-refaktor; isolér mock-data, flytt API-kall til hooks

### Arkivert refaktorlogg (runde 1)

| Dato       | Beskrivelse                                                                                                                                                                                                                                                    | Berørte filer                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-01-XX | Opprettet branch `refaktor`                                                                                                                                                                                                                                  | `git`                                                                                                                                                                                                                                                                                                                                                                     |
| 2025-01-XX | Oppdatert `loadEnv.ts` til å laste `.env` uten logging                                                                                                                                                                                                    | `loadEnv.ts`                                                                                                                                                                                                                                                                                                                                                              |
| 2025-01-XX | La til typed runtime-config `server/config/runtime.ts` med zod-validering; avviklet direkte `.env`-tilgang i building-info-service og API/proxy startskript                                                                                                | `server/config/runtime.ts`, `services/building-info-service/index.ts`, `server/index.ts`, `src/api-server.ts`, `start-ui-only.sh`                                                                                                                                                                                                                                 |
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
| 2025-09-19 | Fjernet legacy `server/index.ts` og `src/api-server.ts`; oppdatert start-skript (`start-ui-only.*`) og dokumentasjon til å peke på `apps/backend/src/index.ts`; `npx tsc --noEmit`, `npm run lint` kjørt                                        | `start-ui-only.sh`, `start-ui-only.bat`, `UI-MOCKUP-README.md`, `package.json`                                                                                                                                                                                                                                                                                      |
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
