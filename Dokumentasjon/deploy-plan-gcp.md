# Plan for Energinøkkelen i Google Cloud

> **Formål**: Dette dokumentet er “single source of truth” for Energinøkkelen sin Google Cloud-deploy. Innholdet dekker arkitekturvalg, endringsbehov i kode, etablering av infrastruktur, test- og driftsrutiner, samt en løpende fremdriftslogg og neste steg. Dokumentet skal oppdateres kontinuerlig etter hvert trinn i planen.

## Mål og rammer
- Kjør backendene (`building-info-service`, `api-server`, `solar-service`) og React-frontend i Google Cloud med minimal håndtering.
- Støtt både test/preprod og prod, med korte sykluser for kodeoppdateringer via Git.
- Ivareta krav om hemmelighold av Matrikkel/Enova-nøkler, støtte Python-skriptene og eksponere Prometheus-metrikker.

## Fremdriftsplan (SSOT)
| Trinn | Beskrivelse | Hovedaktiviteter | Tester / kvalitetssikring |
| --- | --- | --- | --- |
| 1 | Revisjon og klargjøring av kode | Gjennomfør endringene beskrevet i «Kode- og container-tilpasninger» (env-konfig, runtime-content, proxyer). | `npm run verify`, manuelle funksjonelle tester lokalt (`npm run dev`, sjekk `/metrics`, `/api/gul-liste/*`). |
| 2 | Infrastrukturgrunnlag | Sett opp Artifact Registry, Secret Manager, service accounts, buckets, Cloud CDN-skjelett. | `gcloud`-kommandoer med `--dry-run` der mulig, verifiser IAM via `gcloud projects get-iam-policy`. |
| 3 | CI/CD-pipeline | Opprett/oppdater `cloudbuild.yaml`, definer GitHub-trigger, legg inn approval-trinn. | Test Cloud Build manuelt: `gcloud builds submit` (dry-run), verifiser artifacts i registry og GCS. |
| 4 | Cloud Run deploy (staging) | Lag `cloudrun.yaml` med tre containere, deploy til staging-prosjekt, verifiser at backend henter secrets via Secret Manager. | Smoke-test: `curl` mot `/health`, `/metrics`, `/api/address-lookup`, `/api/gul-liste/sjekk-adresse`. Kjør `npm run test:full-chain` mot staging-URL (LIVE=1). |
| 5 | Frontend/CDN utrulling | Publiser `dist/` til `energinokkelen-frontend` og runtime-content til `energinokkelen-content`, sett opp Cloud CDN med SSL og SPA rewrite, bekreft at frontend laster `app.json`/content uten rebuild. | Åpne staging-URL i nettleser, kjør synthetic test (f.eks. `npx playwright` smoke), invalidér CDN-cache ved oppdatering. |
| 6 | Produksjonsklarering | Gjennomgå logg/målinger, avklar åpne punkter (fast IP, auth). | Dokumentert sjekkliste, sign-off. |
| 7 | Produksjonsdeploy | Kjør Cloud Build med prod-substitusjoner, oppdater Cloud Run prod, sync GCS prod, invalider CDN. | Post-deploy monitoring 24h, `curl`-smoke, dashboards. |
| 8 | Etterarbeid og rutiner | Etabler planlagte jobber (Scheduler), dokumenter driftsrutiner og rollback. | Test Scheduler-jobb (manual trigger), verifiser backup-script. |

> Etter hvert trinn skal denne filen oppdateres med logg (dato, ansvarlig, hva, referanser) under «Fremdriftslogg». Testresultater og avvik føres i samme seksjon.

## Foreslått arkitektur
- **Artifact Registry**: Ett Docker-repository (f.eks. `europe-north1-docker.pkg.dev/<prosjekt>/energinokkelen/app`).
- **Cloud Build**: Bygger container-image ved push til main/hoved-branch og tagger med både git-SHA og semantisk tag. Pipeline publiserer også statiske artefakter og innholdsfiler.
- **Cloud Run (multi-container)**:
  - Container 1 (`api-server`): lytter på port 8080 (sett `API_PORT=8080` via env). Eksponerer REST-endepunkt, proxyer `/metrics`, én prosess per container.
  - Container 2 (`building-info-service`): lytter på port 4000, kun intern trafikk. `api-server` når den via `http://localhost:4000`.
  - Container 3 (`solar-service`): beholdes som egen prosess på port 4003. `api-server` proxier alle solinnstrålingskall mot `http://localhost:4003`.
  - **Konfigurasjon**: min-instans=0, max=4 (kan justeres). Aktiver CPU “always allocated” for å støtte Python-kjøring ved kall.
  - **VPC Connector**: etableres dersom eksterne APIer krever fast IP eller privat tilkobling.
- **Secret Manager**: lagrer `MATRIKKEL_*`, `ENOVA_API_KEY`, mm. Cloud Build og Cloud Run får tilgang via IAM.
- **Cloud Storage / Cloud CDN**:
  - `energinokkelen-frontend` bucket hoster Vite sitt `dist/`-innhold som statiske filer. Cloud CDN frontes via ønsket domene (f.eks. `app.energinokkelen.no`) og gir rask levering globalt.
  - `energinokkelen-content` bucket lagrer redigerbart innhold (tekster, energispareparametre, tilskuddsdata) som JSON/YAML. Bygge- og runtime-løpet leser filene.
  - `energinokkelen-data` bucket holder tunge rådata (Excel/CSV) og genererte cache-filer dersom vi fjerner dem fra Docker-image.
- **Cloud Monitoring/Logging**: standard logging + dashbord for Prometheus-metrikker via `/metrics`-proxy.
- **Optional**: Cloud Scheduler + Cloud Functions for automatiske cache-oppdateringer (tilskudd, Excel-import, gul liste-cache).

## Kode- og container-tilpasninger
1. **Dockerfile**:
   - Installer Python 3 + `openpyxl` i runtime-laget.
   - Legg `scripts/python` i PATH og sørg for `LC_ALL`, `LANG`, `PYTHONIOENCODING` satt til UTF-8.
   - Behold multi-stage; Cloud Run multi-container defineres i YAML (ingen prosess-manager nødvendig).
2. **API-port og server**:
   - Les `API_PORT` fra env og default til `process.env.PORT || 8080`.
   - Legg inn `/metrics`-proxy i `api-server` som henter `http://localhost:4000/metrics`.
   - Legg til generell `/config`-route som serverer content-filer (se punkt om dynamisk innhold).
3. **Frontend-konfig**:
   - Fjern hardkodede `http://localhost:3001` URL-er. Bruk `import.meta.env.VITE_API_BASE_URL` og last fallback-konfig via `/config/app.json`.
   - Legg til runtime-config bootstrap i SPA (`fetch('/config/app.json')` på startup) slik at API-base og feature-flags kan oppdateres uten rebuild.
4. **Dynamisk tekst og energi-/tilskuddsdata**:
   - Flytt tekst- og verdikilder ut av kode:
     - Opprett `content/`-mappe (i repo) med JSON/YAML for:
       - UI-tekster (f.eks. `content/ui/texts.nb.json`).
       - Energisparingsparametre (`content/config/energy-savings.json`).
       - Tiltak- og tilskuddsoppsett (`content/tilskudd/tiltak.json`).
     - Cloud Build publiserer disse filene til `energinokkelen-content` bucket.
   - Oppdater frontend-hookene til å hente tekst og energidata fra `/config`-endpoint eller direkte fra GCS via signed URL (Cloud Run anbefales som proxy for auth/CORS).
   - For støtteordninger:
     - Flytt Excel-importen til en bakgrunnsjobb: Cloud Function eller planlagt Cloud Build kjører `stotteordning_cache.py`, skriver ut JSON i `energinokkelen-content/tilskudd.json`.
     - `api-server` leser denne JSON-en fra GCS ved oppstart (cache i minne med TTL) og eksponerer CRUD-endepunkt for manuell regenerering.
     - Vurder et enkelt CMS (f.eks. Headless via Google Sheets/Firestore) hvis Excel må fases ut.
5. **Solar-service og gul liste**:
   - Konfigurer `SOLAR_SERVICE_URL=http://localhost:4003` i `api-server`.
   - Sørg for at `api-server` eksponerer sol-endepunkt via eget proxy-endepunkt (f.eks. `/api/solar/*`) slik at frontend aldri kaller `solar-service` direkte.
   - Legg til readiness-/liveness-prober på `solar-service` container (`/health`).
   - Sikre at gul liste-endepunktene (`/api/gul-liste/*`) forblir tilgjengelige. `api-server` må kunne nå PBE WFS (`https://od2.pbe.oslo.kommune.no/`) og Geonorge API; vurder tidsouts og retry-logikk.
   - Vurder caching av gul liste-svar i Redis/Memorystore eller in-memory med TTL for å redusere trykk mot eksterne tjenester.
6. **Runtime-konfig**:
   - Utvid `packages/config` til å støtte “remote content”. Eksempel: `CONTENT_BUCKET_URL`, `CONTENT_VERSION`.
   - Legg til health-endepunkt for å sjekke at content ble lastet (`/health` returnerer også content timestamp).
7. **CORS**:
   - Sett `origin`-liste i `api-server` til å inkludere Cloud CDN-domenet og staging-domener.
   - Konfigurer Cloud CDN til å forwarde `Authorization` hvis API-et senere trenger IAP/IAM-auth.

## Førstegangsoppsett
1. **Prosjektkonfigurasjon**:
   - Sett aktivt prosjekt i `gcloud` (`gcloud config set project <prosjekt-id>`).
   - Aktiver APIer: `cloudbuild.googleapis.com`, `run.googleapis.com`, `artifactregistry.googleapis.com`, `secretmanager.googleapis.com`, `compute.googleapis.com` (for VPC).
2. **Artifact Registry**:
   - `gcloud artifacts repositories create energinokkelen --repository-format=docker --location=europe-north1`.
3. **Secret Manager**:
   - Opprett secrets for alle hemmeligheter (eks: `energinokkelen-matrikkel-prod`, `energinokkelen-matrikkel-test`, `energinokkelen-enova`).
   - Gi Cloud Build og Cloud Run service accounts `Secret Accessor`.
4. **Service Accounts**:
   - `cloud-build-sa`: `roles/cloudbuild.builds.editor`, `roles/run.admin`, `roles/iam.serviceAccountUser`, `roles/secretmanager.secretAccessor`.
   - `run-energinokkelen`: `roles/run.invoker`, `roles/logging.logWriter`, `roles/monitoring.metricWriter`, `roles/secretmanager.secretAccessor`.
5. **Cloud Build trigger**:
   - `deploy/gcp/cloudbuild.yaml` er utgangspunktet. Pipeline-steg:
     1. `npm ci`
     2. `npm run verify:ci` (typecheck + lint + kontrakttester uten smoke fordi Cloud Build ikke kan åpne porter)
     3. `npm run build:prod`
     4. Bygg/push container-image til Artifact Registry (`${_REGION}-docker.pkg.dev/$PROJECT_ID/${_REPOSITORY}/app:${SHORT_SHA}`)
     5. `gsutil -m rsync` av `dist/` og `content/` til `energinokkelen-{frontend,content}`
     6. Render `cloudrun.yaml` (envsubst) og `gcloud run services replace` (kan toggles med `_DEPLOY`).
   - Substitusjoner (staging default): `_REGION`, `_REPOSITORY`, `_API_ENV`, `_FRONTEND_BUCKET`, `_CONTENT_BUCKET`, `_DEPLOY`.
   - Legg til manuelt Approval-trinn før prod.
   - Sett GitHub trigger (main) og evt. tag-trigger for prod.
6. **Cloud Run deploy**:
   - `deploy/gcp/cloudrun.yaml` definerer tre containere (api-server, building-info-service, solar-service) med Secret Manager mapping og container-dependencies.
   - Deploy via `gcloud run services replace` (Cloud Build gjør dette når `_DEPLOY=true`).
7. **Frontend/CDN**:
   - Sett opp Cloud Storage bucket med public access via Cloud CDN (bruk signed URL/bucket policy only).
   - Konfigurer Load Balancer + CDN endpoint med SSL (Managed cert).
   - Legg `app.json` (runtime-config) i bucketen. Cloud CDN invalidasjon når filer oppdateres (`gcloud compute backend-buckets update-... --signed-url-cache-max-age`).
   - Implementer fallback for SPA-ruter (`/index.html`) via URL rewrite.
8. **Monitoring**:
   - Lag Cloud Monitoring dashboard med viktige metrikker (`building_info_service_lookup_duration_seconds`, cache hits, error count).
   - Sett opp oppetidsvarsel mot `/health`.
9. **Tilgangsstyring**:
   - Bruk IAM-roller for team (viewer, developer, release).
   - For API-eksponering, vurder Cloud Endpoints/API Gateway for rate-limit og auth.

### Referansekommandoer for trinn 2 (Infrastrukturgrunnlag)
> Tilpass variablene før kjøring. Kommandoene kan kjøres flere ganger; eksisterende ressurser vil i så fall gi “already exists”-feil som kan ignoreres etter manuell verifisering.

```bash
export PROJECT_ID="energiverktoy-poc-1234"          # Prod-/staging-prosjekt for Energinøkkelen
export REGION="europe-north1"
export REPOSITORY="energinokkelen"
export FRONTEND_BUCKET="energinokkelen-frontend"
export CONTENT_BUCKET="energinokkelen-content"
export DATA_BUCKET="energinokkelen-data"

gcloud config set project "${PROJECT_ID}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com

gcloud artifacts repositories create "${REPOSITORY}" \
  --location="${REGION}" \
  --repository-format=docker \
  --description="Energinøkkelen containere"

gcloud iam service-accounts create cloud-build \
  --display-name="Cloud Build (Energinøkkelen)"

gcloud iam service-accounts create run-energinokkelen \
  --display-name="Cloud Run runtime (Energinøkkelen)"

export CLOUD_BUILD_SA="cloud-build@${PROJECT_ID}.iam.gserviceaccount.com"
export RUN_SA="run-energinokkelen@${PROJECT_ID}.iam.gserviceaccount.com"

for ROLE in roles/cloudbuild.builds.editor roles/run.admin roles/artifactregistry.writer roles/secretmanager.secretAccessor roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${CLOUD_BUILD_SA}" \
    --role="${ROLE}"
done

for ROLE in roles/logging.logWriter roles/monitoring.metricWriter roles/secretmanager.secretAccessor roles/artifactregistry.reader; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${RUN_SA}" \
    --role="${ROLE}"
done

gcloud iam service-accounts add-iam-policy-binding "${RUN_SA}" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"

for BUCKET in "${FRONTEND_BUCKET}" "${CONTENT_BUCKET}" "${DATA_BUCKET}"; do
  gcloud storage buckets create "gs://${BUCKET}" \
    --location="${REGION}" \
    --uniform-bucket-level-access
done

for BUCKET in "${FRONTEND_BUCKET}" "${CONTENT_BUCKET}"; do
  gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
    --member="serviceAccount:${CLOUD_BUILD_SA}" \
    --role="roles/storage.objectAdmin"
done

gcloud storage buckets add-iam-policy-binding "gs://${CONTENT_BUCKET}" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/storage.objectViewer"

gcloud storage buckets add-iam-policy-binding "gs://${DATA_BUCKET}" \
  --member="serviceAccount:${RUN_SA}" \
  --role="roles/storage.objectViewer"

for SECRET in energinokkelen-matrikkel-prod energinokkelen-matrikkel-test energinokkelen-enova; do
  gcloud secrets create "${SECRET}" --replication-policy="automatic"
done

# Last inn hemmeligheter (erstatt med faktisk payload)
printf "%s" "$MATRIKKEL_PROD_JSON" | gcloud secrets versions add energinokkelen-matrikkel-prod --data-file=-
printf "%s" "$MATRIKKEL_TEST_JSON" | gcloud secrets versions add energinokkelen-matrikkel-test --data-file=-
printf "%s" "$ENOVA_API_KEY" | gcloud secrets versions add energinokkelen-enova --data-file=-

gcloud projects get-iam-policy "${PROJECT_ID}" \
  --flatten="bindings[].members" \
  --filter="bindings.members:${CLOUD_BUILD_SA}" \
  --format="table(bindings.role, bindings.members)"

gcloud projects get-iam-policy "${PROJECT_ID}" \
  --flatten="bindings[].members" \
  --filter="bindings.members:${RUN_SA}" \
  --format="table(bindings.role, bindings.members)"
```

Status 2025-10-23: Kommandoene er kjørt mot `energiverktoy-poc-1234`. Artifact Registry `energinokkelen`, servicekontoene `cloud-build` og `run-energinokkelen`, bøttene `energinokkelen-{frontend,content,data}` og hemmelighetene i Secret Manager er på plass. Secrets følger nå `.env`-navn (f.eks. `MATRIKKEL_USERNAME`, `MATRIKKEL_PASSWORD`, `ENOVA_API_KEY`) og har første versjon lagret.

#### Secret Manager → miljøvariabler
| Secret-navn | Bruk i kode | Notat |
| --- | --- | --- |
| `MATRIKKEL_USERNAME`, `MATRIKKEL_PASSWORD` | services/building-info-service (`packages/config`) | Prod-kredentialer; lastes inn som standard |
| `MATRIKKEL_USERNAME_TEST`, `MATRIKKEL_API_BASE_URL_TEST` | Test-miljøer (`API_ENV=test`) | Brukes når `API_ENV=test` |
| `MATRIKKEL_API_BASE_URL_PROD` | Prod-endepunkt | Overskriver default URL dersom nødvendig |
| `MATRIKKEL_SNAPSHOT_VERSION`, `MATRIKKEL_SYSTEM_VERSION` | Dokumentasjon/diagnostikk (eksponeres i metrics/logg) | Oppdateres ved ny Matrikkel-kilde |
| `ENOVA_API_KEY` | `services/building-info-service/enova.ts` via `packages/config` | HTTP header for Enova API |
| `PBE_MAP_BASE_URL`, `PBE_IDENTIFY_TOLERANCE` | `services/solar-service` / gul liste-kall | Holder API URL og søketoleranse |
| `VITE_API_PROXY_URL`, `VITE_BIS_BASE`, `LIVE` | Frontend runtime (`app.json`, SPA bootstrap) | Eksponeres via `/config/app.json` |

Cloud Run må knytte secrets til miljøvariabler ved deploy, eksempel:

```bash
gcloud run services update cloudrun-energinokkelen \
  --add-cloudsql-instances=... \
  --set-secrets=MATRIKKEL_USERNAME=MATRIKKEL_USERNAME:latest,MATRIKKEL_PASSWORD=MATRIKKEL_PASSWORD:latest \
  --set-secrets=ENOVA_API_KEY=ENOVA_API_KEY:latest \
  --set-env-vars=CONTENT_BUCKET=energinokkelen-content,VITE_API_PROXY_URL=projects/-/secrets/VITE_API_PROXY_URL/versions/latest
```

> For `VITE_*` secrets: Cloud Build leser verdiene fra Secret Manager under build, mens frontend ved runtime henter `app.json` fra `energinokkelen-content`. Hold `app.json` oppdatert med nye verdier ved å oppdatere `content/` og kjøre `gsutil rsync`.

#### Bucketer og Cloud CDN
- `energinokkelen-frontend`: byggartefakter (`dist/`). Frontes av Cloud CDN og invaliders ved hver deploy.
- `energinokkelen-content`: runtime-konfig, tekster, energidata. API-server må kunne lese filene (GCS REST eller signed URL). Oppdateringer kan pushes uten rebuild.
- `energinokkelen-data`: rådata/større filer (CSV/Excel). Beskyttet; API-server leser ved behov.

Cloud Build må `gsutil rsync` både `dist/` og `content/` til respektive bøtter etter vellykket build.

### Cloud Build-mal (`deploy/gcp/cloudbuild.yaml`)
- Bruker standard Node + Docker build-steg, og gjenbruker substitutions for region, repository, buckets og API-miljø.
- npm-stegene kjører på `node:20`-image slik at `node --import tsx` støttes i kontrakttestene.
- Lagrer beregnet image-URI i `/workspace/image-uri.txt` og gjenbruker i push/Cloud Run-steg.
- `_DEPLOY=false` kan benyttes i test-trigger for å hoppe over produksjonsdeploy (kun bygg + artefakter).
- Pipeline rendrer `deploy/gcp/cloudrun.yaml` med `envsubst`, slik at `${IMAGE_URI}`, `${PROJECT_ID}` og `${API_ENV}` fylles automatisk før `gcloud run services replace`.

### Cloud Run-konfig (`deploy/gcp/cloudrun.yaml`)
- Multi-container Service (`api-server`, `building-info-service`, `solar-service`) som peker til samme image med ulike `command`.
- Secrets mappes via `valueSource.secretKeyRef` til miljøvariabler (MATRIKKEL_*, ENOVA_API_KEY, LIVE, VITE_*, PBE_*).
- `run.googleapis.com/container-dependencies` sørger for at api-server venter på sidecar-tjenestene.
- Containerne bruker interne porter 8080/4000/4003, og API-server eksponeres eksternt via Cloud Run.
- Default ressursgrenser: 1 CPU / 1Gi for backend-containerne, 0.5 CPU / 512Mi for solar-service. Juster ved behov.

## Oppdateringsflyt
1. Utvikler lager branch, kjører lokalt `npm run verify`.
2. Pull request → merge til main.
3. Cloud Build trigger:
   - Kjører tester/build.
   - Depoyer Cloud Run test + synker frontend/content til test-buckets.
4. Automatisk smoke-test skript (Cloud Build post-step) treffer `/health` og `/config/app.json`.
5. Approval for prod → deployer Cloud Run prod + synker frontend/content til prod-buckets.
6. Cloud CDN invalidasjon (hurtig `gcloud compute url-maps invalidate-cdn-cache`).
7. Logging/Dashbord overvåkes for regressjoner.

## Driftsrutiner
- **Secrets**: roter `MATRIKKEL_*` jevnlig; bruk Secret Manager versions og Cloud Build substitutions.
- **Innhold**:
  - Rediger tekst/konfig i `content/`-repoet. Merge → Cloud Build synker til GCS automatisk.
  - For akutte endringer uten deploy: bruk manuelt script (`gsutil rsync`) + Cloud CDN invalidasjon.
- **Tilskuddsdata**:
  - Cloud Scheduler trigger (daglig/ukentlig) kjører `stotteordning_cache.py` og oppdaterer `tilskudd.json`.
  - Ved manuelle endringer, rediger JSON direkte eller oppdater kilde-filen (Excel) og kjør funksjonen on-demand.
- **Gul liste**:
  - Overvåk eksterne API-avhengigheter (WFS og Geonorge). Legg til syntetisk monitor som kaller `/api/gul-liste/sjekk-adresse`.
  - Sett opp rate-limit og fallback (bufrede svar) dersom eksterne tjenester er utilgjengelige.
- **Backup**: ta jevnlige eksport av `energinokkelen-content` og `energinokkelen-data` buckets (gsutil + lifecycle).
- **Incident response**: hold forrige Cloud Run revision og forrige content-versjon tilgjengelig. Bruk `gcloud run services update-traffic` og `gsutil -m rsync` til rollback.
- **Testing**: kjør `npm run test:full-chain` (krever lokal nettverksadgang til `localhost:4000/4003`; i begrensede sandkasser kan `SOLAR_SERVICE_MOCK=1` brukes). Kjør deretter `npm run test:full-chain -- --address="<testadresse>"` etter behov. Legg til end-to-end smoke mot CDN-hostet frontend (syntetisk monitoring).

## Åpne avklaringer
| Tema | Status | Tiltak / Owner | Kommentar |
| --- | --- | --- | --- |
| Matrikkel-tilgang (fast IP?) | Avklart | Curl mot prod/test ga respons (SOAP fault når payload mangler felt). Ingen IP-whitelist observert. | Ingen VPC/NAT nødvendig nå. Overvåk og avklar på nytt hvis Kartverket endrer policy. |
| Enova API | Avklart (nettverk) | `curl` med API-nøkkel returnerte 401 → nøkkel/parametre må verifiseres, men endpoint er tilgjengelig. Enova oppgir at IP-whitelist ikke kreves. | Test med kjent adresse når staging står, logg 40x for å fange feil nøkkel. |
| PBE Solkart fra GCP | Avklart (teknisk) | Test: `curl` mot WFS med `map=d:/data_mapserver/kartfiler/solkart.map` ga 200. Magnus avklarer formelt kvoter/policy. | Ingen teknisk blokk; legg inn caching/ratelimiting ved behov. |
| API-autentisering (IAP/Gateway) | Avklart foreløpig | Team: start uten auth, vurder Cloud Armor/IAP før prod launch. | Bruk CORS whitelist og logger; planlegg AuthN i fase 2. |
| Content-format (tekster, parametre) | Avklart | Team: JSON-filer i `content/` → publiseres til `energinokkelen-content`. | Beholder Git som kilde; struktur dokumentert i Kode-tilpasninger. |
| Excel-avvik / datakvalitet | Åpen | Team: lag validasjonsskript i Cloud Build før synk; dok i backlog. | Krever script som sjekker kolonneendringer og logger diff. |
| Fremtidig skrive-API / lagring | Åpen | Produkt: avgjør behov; vurder Firestore/Cloud SQL hvis nødvendig. | Ikke blocker for første release. |
| Gul liste / Geonorge IP-krav | Avklart | Curl mot Geonorge ga 200. Ingen IP-krav observert. | Ingen tiltak nødvendig. |

## Fremdriftslogg
| Dato | Trinn | Utført av | Aktivitet / funn | Tester |
| --- | --- | --- | --- | --- |
| 2025-10-23 | Åpne avklaringer | Codex | Verifisert eksterne endepunkt (PBE WFS, Geonorge, Matrikkel SOAP, Enova). Ingen IP-whitelist observert; 401 skyldes krav til gyldige credentials/parametre. Status-tabell oppdatert. | `curl https://od2.pbe.oslo.kommune.no/...`, `curl https://ws.geonorge.no/...`, `curl https://www.matrikkel.no/...`, `curl https://api.data.enova.no/...` |
| 2025-10-23 | Trinn 1 – Kode/konfig | Codex | La til runtime-konfig for frontend (`/config/app.json`), API-proxy for metrics og config, samt fjernet hardkodede localhost-URL-er. Oppdatert Dockerfile til å inkludere `content/`. | `npm run typecheck`, `npm run lint` |
| 2025-10-23 | Trinn 1 – Kode/konfig | Codex | Parameteriserte solar-service og gul-liste-service med miljøvariabler, la til `scripts/test-api-smoke.ts` + `npm run test:smoke`, dokumenterte nye env-variabler i README. | `npm run typecheck`, `npm run lint`, `npm run test:smoke` |
| 2025-10-23 | Trinn 2 – Infrastruktur | Codex | Dokumenterte gcloud-kommandoer for Artifact Registry, servicekontoer, buckets og secrets. Avklarte rolleoppsett og bucket-tilganger, satte prosjekt-id til `energiverktoy-poc-1234`. | Ikke kjørt (kommandoer forberedt) |
| 2025-10-23 | Trinn 2 – Infrastruktur | Codex | Aktiverte API-er, opprettet Artifact Registry `energinokkelen`, servicekontoer m/roller, GCS-bøtter og tomme secrets (`energinokkelen-*`). Bekreftet IAM-tilganger. | `gcloud services enable`, `gcloud artifacts repositories create`, `gcloud iam ...`, `gcloud storage buckets ...`, `gcloud secrets ...` |
| 2025-10-23 | Trinn 2 – Infrastruktur | Magnus | Opprettet Secret Manager secrets iht. `.env`-navn (`MATRIKKEL_*`, `ENOVA_API_KEY`, `VITE_*`, m.fl.) og la inn første versjon for hver. Slettet midlertidige `energinokkelen-*` secrets. | GCP Console (manuell), `gcloud secrets list` |
| 2025-10-23 | Trinn 2 – Infrastruktur | Codex | Dokumenterte secret-mapping og bucket-strategi (Cloud Run/Cloud Build) i SSOT. | Dokumentasjon oppdatert |
| 2025-10-23 | Trinn 3 – CI/CD | Codex | La til `deploy/gcp/cloudbuild.yaml` og `deploy/gcp/cloudrun.yaml`, beskrev pipeline, multi-container og deploy-logikk. | Ikke kjørt (yaml-utkast) |
| 2025-10-23 | Trinn 3 – CI/CD | Codex | Opprettet `npm run verify:ci` (skip smoke) og justerte Cloud Build til å bruke denne, samt ga Cloud Build-SA tilgang til secrets/lagring/logging. Foreløpig bygg feiler fordi smoketesten er flyttet ut og logs må hentes via Cloud Logging. | `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _DEPLOY=false,_TAG=manual-test` |
| 2025-10-23 | Trinn 3 – CI/CD | Codex | Byttet npm-steg til `node:20` image, erstattet Python med `sed`, og kjørte vellykket Cloud Build (build-id `a3bc9367-1191-4560-b036-2fe41de50b97`) som bygger, pusher og synker artefakter (DEPLOY=false). | `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _DEPLOY=false,_TAG=manual-test` |

## Neste steg
> Etter hver oppdatering av loggen skal dette avsnittet beskrive hva som gjenstår før neste loggførte trinn, hvem som eier oppgaven og eventuelle blokkere. Oppdateres i takt med fremdriftsloggen og planen over.

- Opprett Cloud Build-trigger(e) i GCP: en for staging (`_TAG=staging-<shortSHA>`, `_DEPLOY=true`) og evt. egen prod-trigger med approvals. Dokumenter navn, substitutions og repository-tilkobling (Magnus).
- Kjør første staging-build manuelt: `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _TAG=staging-test,_DEPLOY=true,_API_ENV=test` og verifiser at Cloud Run-tjenesten starter, at frontend/content er synket til GCS og at `/health` svarer (Codex).
- Etter staging-verifisering: legg inn sedvanlige kvalitetsjekker (npm run test:smoke mot staging, manuell UI-test) og forbered prodkonfigurasjon (Secrets/ENV, trigger med approval) før Trinn 4 (Magnus/Codex).
