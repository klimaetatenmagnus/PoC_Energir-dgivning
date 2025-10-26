# Plan for Energinøkkelen i Google Cloud

> **Merk:** Denne planen er historisk referanse. Gjeldende driftsdokumentasjon ligger i `Dokumentasjon/gcp-driftshandbok.md` og skal brukes som “single source of truth” fremover.

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
  - **Staging**: `energinokkelen-frontend` (SPA-build) og `energinokkelen-content` (runtime-innhold). Begge synkes av Cloud Build ved hver staging-deploy.
  - **Produksjon**: `energinokkelen-frontend-prod` og `energinokkelen-content-prod`. `energinokkelen-frontend-prod` er konfigurert som GCS website (`index.html` default/error) og eksponeres via Cloud CDN (`prod-frontend-bucket`). Cloud Build prod-trigger synker `dist/` og `content/` hit.
  - `energinokkelen-data` bucket holder tunge rådata (Excel/CSV) og genererte cache-filer dersom vi fjerner dem fra Docker-image.
- **Cloud Monitoring/Logging**: standard logging + dashbord for Prometheus-metrikker via `/metrics`-proxy.
- **Optional**: Cloud Scheduler + Cloud Functions for automatiske cache-oppdateringer (tilskudd, Excel-import, gul liste-cache).

## Kode- og container-tilpasninger
1. **Dockerfile**:
   - Installer Python 3 i runtime-laget (f.eks. `apt-get install -y --no-install-recommends python3 python3-pip`).
   - Legg alle Python-avhengigheter i `python/requirements.txt` (minst `requests`, `openpyxl`). Installer med `python3 -m pip install --no-cache-dir --requirement python/requirements.txt --target /opt/python`.
   - Sett `ENV PYTHONPATH=/opt/python` og `ENV PYTHON_BINARY=/usr/bin/python3` for å sikre at `api-server` finner tolken uten symlink.
   - Sørg for at `scripts/python` fortsatt kopieres inn i imagen. `LC_ALL`, `LANG`, `PYTHONIOENCODING` settes til UTF-8.
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
   - Konfigurer `SOLAR_SERVICE_BASE_URL=http://127.0.0.1:4003` og `SOLAR_SERVICE_PORT=4003` i Cloud Run (ligger allerede i `cloudrun.yaml` for `api-server` og `solar-service`).
   - Opprett dedikert proxy i `api-server` (GET `/api/solar/*`) som videresender til `SOLAR_SERVICE_BASE_URL`. Proxyen må beholde querystring, statuskode og `Content-Type`.
   - Frontend må lese `solarProxyBaseUrl` fra runtime-konfig (`loadAppConfig`) i stedet for hardkodet `http://localhost:4003`. Default i `content/app.json` er `/api/solar`, slik at CDN → Cloud Run → solar fungerer uten ekstra oppsett.
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
- `_SERVICE_NAME` styrer Cloud Run-tjenestenavn (default `energinokkelen`). Setter `energinokkelen-prod` i prod-trigger.

#### Foreslått prod-trigger (Cloud Build)
- **Trigger-navn**: `energinokkelen-prod`
- **Substitutions**:
  - `_REGION=europe-north1`
  - `_REPOSITORY=energinokkelen`
  - `_FRONTEND_BUCKET=gs://energinokkelen-frontend-prod`
  - `_CONTENT_BUCKET=gs://energinokkelen-content-prod`
  - `_API_ENV=prod`
  - `_DEPLOY=true`
  - `_SERVICE_NAME=energinokkelen-prod`
- **Approval**: slå på "Require approval" i Cloud Build UI. Prod-triggere skal alltid stoppe for manuell sign-off (Trinn 6 → Trinn 7).
- **Artifacts**: samme Docker-repo; Cloud Run-prod service får latest revision ved godkjent deploy.
- **Secrets**: gjenbruker Secret Manager-variabler (`MATRIKKEL_*`, `ENOVA_API_KEY`, `LIVE` osv.). Sørg for at prod-versjonene er satt i Secret Manager før første kjøring.
- **IAM**: prod-triggeren kjører med `cloud-build@$PROJECT_ID` og trenger `roles/run.admin`, `roles/secretmanager.secretAccessor`, `roles/storage.admin` i prod-prosjektet. Gi `serviceAccount:cloud-build@{prod-project}.iam.gserviceaccount.com` rettighetene før aktiv bruk.

##### Opprydding av staging (Trinn 6 – klarering)
- Fjern midlertidig `allUsers`-tilgang på Cloud Run når testing er ferdig:
  ```bash
  gcloud run services remove-iam-policy-binding energinokkelen \
    --region europe-north1 \
    --member=allUsers \
    --role=roles/run.invoker
  ```
- Oppdater Cloud CDN/Load Balancer for å begrense offentlig trafikk dersom staging ikke skal være offentlig tilgjengelig.

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
- **Soldata-verifikasjon**: bruk `node --import tsx scripts/compare-solar-vs-csv.ts` for å sammenligne ADRID-baserte soldata mot referanse-CSV-er i `data/raw/` før større endringer i solar-service. Detaljert ADRID/delta-testlogikk ligger i `scripts/test-solar-adrid.ts` hvis vi trenger å justere søke-parametere eller kjøre enkelttester.

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
| 2025-10-24 | Trinn 3 – CI/CD | Codex | Forsøkte å opprette GitHub-trigger for `deploy/gcp`, men Cloud Build manglet GitHub App-tilkobling → API returnerte `INVALID_ARGUMENT`. | `gcloud builds triggers create github ...` (feiler) |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Oppdaterte Dockerfile (kopierer `services/`), bundlet `solar-service` i `dist/backend`, la til health-endepunkt og startup probes for sidecar-containerne. Kjørte staging-build (id `c35d5da6-01e5-44c8-baff-38feb2ebe32b`) som deployerte Cloud Run `energinokkelen`. Åpnet midlertidig `roles/run.invoker` for `allUsers` og verifiserte `/health`. | `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _TAG=staging-3f62fc7,_DEPLOY=true,_API_ENV=test`, `curl https://energinokkelen-168751968131.europe-north1.run.app/health` |
| 2025-10-24 | Trinn 3 – CI/CD | Codex | Opprettet Cloud Build ↔ GitHub connection `energinokkelen-conn`, registrerte repoet `poc-energiradgivning` og laget staging-trigger `energinokkelen-staging` (region `europe-north1`) som bygger på `deploy/gcp`. Triggeren bruker standard Cloud Build-SA. | `gcloud alpha builds connections create github ...`, `gcloud alpha builds repositories create ...`, `gcloud alpha builds triggers create github ... --service-account=projects/energiverktoy-poc-1234/serviceAccounts/cloud-build@energiverktoy-poc-1234.iam.gserviceaccount.com` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Reviderte Cloud Run-konfig (ny revisjon `energinokkelen-00005-vfr`): satte `api-server` først i containerlisten, fjernet container-dependencies og forsikret at `BUILDING_INFO_PORT` leses fra egen env. `/health` responderer, men `/config/app.json` og `/api/*` returnerer fortsatt 404/`Cannot GET/POST` – videre feilsporing nødvendig. | `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _TAG=staging-3f62fc7,_DEPLOY=true,_API_ENV=test`, `curl https://energinokkelen-168751968131.europe-north1.run.app/*` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Diagnostiserte 404: Cloud Run-logger viste at bundlet `building-info-service` startet i `api-server`-container og tok port 8080. La til eksplisitt standalone-guard i `services/building-info-service/index.ts`, rettet `BUILDING_INFO_BASE_URL` til `http://127.0.0.1:4000` i `cloudrun.yaml`, bygget oppdatert `dist/backend/`. | `gcloud run services describe`, `gcloud logging read`, `npm run verify:ci` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Kjørte Cloud Build deploy (`staging-c94197b`) med oppdatert multi-container-oppsett. Bekreftet at `/health`, `/config/app.json`, `/api/address-suggestions` og `/api/address-lookup` svarer 200 i staging. 404-feilen er løst. | `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _DEPLOY=true,_API_ENV=test,_TAG=staging-c94197b`, `curl https://energinokkelen-168751968131.europe-north1.run.app/...` |
| 2025-10-24 | Trinn 5 – Frontend/CDN | Codex | Reservet global IP (`staging-cdn-ip` → `34.111.174.210`), opprettet Cloud CDN backend bucket + HTTP load balancer (`staging-frontend-bucket`, `staging-frontend-map`, `staging-frontend-proxy`, `staging-frontend-http`). `gs://energinokkelen-frontend` satt opp med `index.html` som default/feilsider og gitt `allUsers`/Compute SA `objectViewer`. `/` og `index.html` svarer 200 via LB; direkte SPA-ruter returnerer index med 404-status (rewrite må justeres før prod/HTTPS). | `gcloud compute addresses/backend-buckets/url-maps/...`, `curl http://34.111.174.210/`, `curl http://34.111.174.210/app` |
| 2025-10-24 | Trinn 5 – Frontend/CDN | Codex | Ledet `/api/*` trafikk fra CDN til Cloud Run via serverless NEG: opprettet `staging-api-neg` + backend service `staging-api-backend`, la `pathMatcher` på `staging-frontend-map`. Adresse- og lookup-endepunkt fungerer nå via IP (`curl http://34.111.174.210/api/address-suggestions?query=Karl`). SPA-ruter trenger fortsatt rewrite før full SPA-støtte. | `gcloud compute network-endpoint-groups create ...`, `gcloud compute backend-services add-backend ...`, `gcloud compute url-maps add-path-matcher ...`, `curl http://34.111.174.210/api/...` |
| 2025-10-24 | Trinn 1 – Kode/konfig | Codex | La til Python 3-runtime i Dockerfile (apt + pip til `/opt/python`), satte UTF-8/PYTHON-env, implementerte `/api/solar`-proxy med eksplisitt GET-handling og la på `/`-status-endepunkt for Cloud Run. Frontend leser nå `solarProxyBaseUrl` via runtime-konfig. | `npm run verify:ci`, `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _DEPLOY=true,_API_ENV=test,_TAG=staging-507fc5a-d` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Kjørte vellykket staging-deploy (`staging-507fc5a-d` → revisjon `energinokkelen-00013-4s2`). Verifiserte rot-endepunkt, `/config/app.json`, helse og solar-proxy (404 på koordinater uten takflater). | `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _DEPLOY=true,_API_ENV=test,_TAG=staging-507fc5a-d`, `gcloud run services describe energinokkelen --region europe-north1`, `curl https://energinokkelen-168751968131.europe-north1.run.app/` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Synkroniserte `content/` til `gs://energinokkelen-content` og bekreftet `/config/app.json` via Cloud Run-staging. | `gcloud storage rsync content gs://energinokkelen-content`, `curl https://energinokkelen-168751968131.europe-north1.run.app/config/app.json` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Validerte sol-proxy med koordinater (Kapellveien 156C). WFS-responsen mangler `bygg_id`, så `/api/solar/solinnstraling` må bruke `lat/lon` eller polygon som fallback. | `curl https://energinokkelen-168751968131.europe-north1.run.app/api/address-lookup`, `curl https://energinokkelen-168751968131.europe-north1.run.app/api/solar/solinnstraling?lat=59.96157167657096&lon=10.780386490046771` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Oppdaterte solar-service til å slå opp via PBE `BYGGNR` og bygde ID-fallback, samt sendte bygningsnummer fra building-info-service før koordinatfallback. Verifisert med kontrakttester. | `npm run verify:ci` |
| 2025-10-24 | Trinn 4 – Cloud Run staging | Codex | Implementerte ADRID/delta-metoden i `solar-service` (ADR-buffersøk, auto-delta og BYGGNR-hydrering) og la inn robuste fallback for koordinater. Lokale kontraktstester/lint grønne; staging-verifisering for Kapellveien 156C planlagt via `curl` fra miljø med nettverk. | `npm run verify:ci` |
| 2025-10-25 | Trinn 4 – Cloud Run staging | Codex | Kjørte Cloud Build med tag `adrid-delta-20250115` (build `74495db5-b67a-4ec9-96ff-8e3c265005f4`). Nye artefakter publisert, Cloud Run oppdatert til revisjon `energinokkelen-00015-lbz`. Direkte staging-kall må utføres fra miljø med nettverkstilgang til PBE/Cloud Run. | `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _DEPLOY=true,_API_ENV=test,_TAG=adrid-delta-20250115` |
| 2025-10-25 | Trinn 4 – Cloud Run staging | Magnus | Verifiserte ADRID/delta-metoden via lokal proxy. `gcloud run services proxy energinokkelen --region europe-north1 --port 8085` + `curl http://127.0.0.1:8085/api/solar/solinnstraling?lat=59.96157167657096&lon=10.780386490046771` returnerte takflater med `bygg_nr` `80179073`/`80179707` og totalt areal 202.46 m² (kategori «Lavt») for Kapellveien 156C. | `curl http://127.0.0.1:8085/api/solar/solinnstraling?...` |
| 2025-10-25 | Trinn 5 – Frontend/CDN | Codex | Implementerte SPA-rewrite i URL map: `/api/*` rutes fortsatt til serverless NEG. Forespørsler med `Accept: text/html` (typisk SPA-navigasjon) rewrites til `/index.html`; øvrige assets leveres uendret. Oppdatering gjort med `gcloud compute url-maps export/import staging-frontend-map`. Nettlesertest fra lokal maskin bekreftet at JS-moduler fortsatt lastes. | `gcloud compute url-maps export/import` |
| 2025-10-25 | Trinn 5 – Frontend/CDN | Codex | Invalidert Cloud CDN-cache (`/index.html`, `/assets/*`, `/*`) og satt `Cache-Control: no-cache` på `index.html`. Verifisert i inkognitovindu at `http://34.111.174.210/app` laster riktig `index-C_gLeYR7.js` uten 404. Prosedyre dokumentert for senere deploys. | `gcloud compute url-maps invalidate-cdn-cache ...`, `gcloud storage objects update ...`, manuell nettlesertest |
| 2025-10-25 | Trinn 4 – Cloud Run staging | Codex | Kjørte `npm run test:smoke` mot staging-URL. API svarte med LIVE-konfig og eksponerte `/config/app.json` samt `/metrics` uten feil. | `npm run test:smoke -- --baseUrl=https://energinokkelen-168751968131.europe-north1.run.app` |
| 2025-10-25 | Trinn 5 – Frontend/CDN | Codex | La til host-rule for `energinokkelen.no`, opprettet Managed SSL (`energinokkelen-managed-ssl`) og HTTPS forwarding-rule på 34.111.174.210. Sertifikatet står i `PROVISIONING` til DNS peker til IP-adressen. | `gcloud compute url-maps add-host-rule ...`, `gcloud compute ssl-certificates create ...`, `gcloud compute target-https-proxies create ...`, `gcloud compute forwarding-rules create ...` |
| 2025-10-25 | Trinn 5 – Frontend/CDN | Codex | Aktiverte Cloud DNS API, opprettet offentlig sone `energinokkel-no` (`xn--energinkkelen-hnb.no.`) med A-record → `34.111.174.210` og `www`-CNAME, og oppdaterte HTTPS-proxyen til å bruke IDN-sertifikat (`energinokkel-idn-managed-ssl`). Domeneshop må settes til Google NS (`ns-cloud-a1`–`a4`) før sertifikatet blir aktivt. | `gcloud services enable dns.googleapis.com`, `gcloud dns managed-zones create`, `gcloud dns record-sets transaction ...`, `gcloud compute target-https-proxies update ...` |
| 2025-10-25 | Trinn 5 – Frontend/CDN | Codex | Delegasjonen fra Domeneshop ble aktivert. Managed sertifikat `energinokkel-20251025` for `xn--energinkkelen-hnb.no` er nå `ACTIVE`. Verifiserte HTTPS-respons (`curl`) og kjørte `npm run test:smoke` mot domenet – `/config/app.json` og `/metrics` responderer OK. | `dig xn--energinkkelen-hnb.no`, `gcloud compute ssl-certificates describe energinokkel-20251025`, `npm run test:smoke -- --baseUrl=https://xn--energinkkelen-hnb.no` |
| 2025-10-25 | Trinn 5 – Frontend/CDN | Codex | Importerte oppdatert URL-map (`deploy/gcp/staging-frontend-map.yaml`) slik at `/config/*` og `/metrics` rutes til Cloud Run-backenden. Bekreftet `https://xn--energinkkelen-hnb.no/config/app.json`, `/metrics` og `/api/address-suggestions` over HTTPS samt SPA-fallback. | `gcloud compute url-maps import staging-frontend-map ...`, `curl https://xn--energinkkelen-hnb.no/config/app.json`, `curl https://xn--energinkkelen-hnb.no/api/address-suggestions?...` |
| 2025-10-25 | Trinn 3 – CI/CD | Codex | Parameteriserte Cloud Run-tjenestenavn via `_SERVICE_NAME` i Cloud Build (`deploy/gcp/cloudbuild.yaml`) og `__SERVICE_NAME__` i `cloudrun.yaml`. Forbereder gjenbruk av samme mal til prod (`energinokkelen-prod`). | `sed ... cloudbuild.yaml`, `sed ... cloudrun.yaml` |
| 2025-10-25 | Trinn 3 – CI/CD | Codex | Oppdaterte Cloud Build-mal/dokumentasjon for prod-triggeren (benytter `_SERVICE_NAME` og prod-bøtter i samme prosjekt). | `sed ... cloudbuild.yaml`, Dokumentasjon oppdatert |
| 2025-10-25 | Trinn 5 – Frontend/CDN | Codex | Opprettet prod-bøtter `energinokkelen-frontend-prod` og `energinokkelen-content-prod` (samme prosjekt som staging), ga Cloud Build SA `storage.objectAdmin` og Cloud Run SA `storage.objectViewer` på content-bøtta. Klart for prod-sync i trinn 7. | `gcloud storage buckets create ...`, `gcloud storage buckets add-iam-policy-binding ...` |
| 2025-10-25 | Trinn 3 – CI/CD | Codex | Opprettet Cloud Build prod-trigger `energinokkelen-prod` (branch `main`, krever approval). Substitusjoner peker til prod-bøttene og `_SERVICE_NAME=energinokkelen-prod`. | `gcloud alpha builds triggers create github ... --require-approval` |
| 2025-10-25 | Trinn 7 – Produksjonsdeploy | Codex | Kjørte manuell Cloud Build (`build 8814a457-63d7-4359-a874-d7ea1028ef61`, tag `prod-initial`) med `_SERVICE_NAME=energinokkelen-prod`, `_API_ENV=prod`. Cloud Run prod-tjeneste `energinokkelen-prod` opprettet (URL `https://energinokkelen-prod-168751968131.europe-north1.run.app`). IAM-policy har ingen `allUsers`-binding (privat). | `gcloud builds submit ...`, `gcloud run services describe energinokkelen-prod`, `gcloud run services get-iam-policy energinokkelen-prod` |
| 2025-10-25 | Trinn 6 – Produksjonsklarering | Codex | Opprettet serverless NEGs: `staging-api-neg` → `energinokkelen`, `prod-api-neg` → `energinokkelen-prod`, og global backend service `prod-api-backend`. La inn midlertidige host-regler (`prod-preview.xn--energinkkelen-hnb.no`, `energinokkelen-prod-…run.app`) som rewritet host-header til Cloud Run default-domener. Verifiserte `/api/address-suggestions` og `/config/app.json` via load balancer (`curl --resolve … --insecure`). `allUsers`-binding fjernet igjen etter testen; kun serverless-robot SA har invoker-tilgang. | `gcloud compute network-endpoint-groups create ...`, `gcloud compute backend-services add-backend ...`, `gcloud compute url-maps import ...`, `gcloud run services remove-iam-policy-binding ...` |
| 2025-10-25 | Trinn 6 – Produksjonsklarering | Codex | Opprettet CDN-backend `prod-frontend-bucket` (peker til `gs://energinokkelen-frontend-prod`) og ga `service-168751968131@compute-system.iam.gserviceaccount.com` `storage.objectViewer`. Oppdaterte URL-map slik at prod-host matcher bruker prod-bucket for statiske filer. | `gcloud compute backend-buckets create prod-frontend-bucket ...`, `gcloud storage buckets add-iam-policy-binding ...`, `gcloud compute url-maps import ...` |
| 2025-10-25 | Trinn 6 – Produksjonsklarering | Codex | Forsøkte nytt managed-sertifikat `energinokkel-prod-ssl`, men ACME fikk kun validert `xn--energinkkelen-hnb.no`. Rullet tilbake til eksisterende cert `energinokkel-20251025` og slettet det nye. | `gcloud compute target-https-proxies update ... --ssl-certificates=energinokkel-20251025`, `gcloud compute ssl-certificates delete energinokkel-prod-ssl` |
| 2025-10-25 | Trinn 7 – Produksjonsdeploy | Codex | Byttet hoveddomene (`xn--energinkkelen-hnb.no`, `energinokkelen.no`) til prod-backend (`prod-api-backend` + `prod-frontend-bucket`). Verifiserte `/api/address-suggestions` og `/config/app.json` via load balancer (`curl --resolve … --insecure`). Prod Cloud Run tillater igjen `allUsers` inntil alternativ auth-løsning er på plass. | `gcloud compute url-maps import ...`, `curl --resolve xn--energinkkelen-hnb.no ...` |
| 2025-10-26 | Trinn 5 – Frontend/CDN | Codex | Bekreftet at `https://xn--energinkkelen-hnb.no` fungerer uten `--resolve/--insecure`, la inn automatisk Cloud CDN-invalidator i Cloud Build (`deploy/gcp/invalidate-cdn-cache.sh`) og kjørte den med `CDN_DRY_RUN=true` for å validere kommandoen (`staging-frontend-map`). | Manuell nettlesertest, `PROJECT_ID=energiverktoy-poc-1234 CDN_DRY_RUN=true ./deploy/gcp/invalidate-cdn-cache.sh staging-frontend-map` |
| 2025-10-26 | Trinn 5 – Frontend/CDN | Codex | Kjørte invalidasjonsskriptet mot `staging-frontend-map` uten `CDN_DRY_RUN` for å bekrefte faktisk Cloud CDN-invalidator. Operasjon `operation-1761433159514-642039dc4b831-999196cc-9e5383b9` fullførte `DONE`. | `PROJECT_ID=energiverktoy-poc-1234 ./deploy/gcp/invalidate-cdn-cache.sh staging-frontend-map`, `gcloud compute operations describe operation-1761433159514-642039dc4b831-999196cc-9e5383b9 --global --project=energiverktoy-poc-1234` |
| 2025-10-26 | Trinn 5 – Frontend/CDN | Codex | Trigget Cloud Build `ecb1868b-f957-4f8e-b269-26b41d71feb8` med `_CDN_DRY_RUN=false`. Bygget feilet i steg “Invalidate CDN cache” fordi Cloud Build SA mangler `compute.urlMaps.invalidateCache`. DNS-innvalidasjon ble deretter kjørt manuelt (`gcloud compute url-maps invalidate-cdn-cache`). | `gcloud builds submit ... --substitutions _CDN_DRY_RUN=false`, Cloud Build logg (linje 2645–2647), `gcloud compute url-maps invalidate-cdn-cache staging-frontend-map --path=/index.html --path=/config/* --path=/assets/* --path=/*` |
| 2025-10-26 | Trinn 5 – Frontend/CDN | Codex | Ga Cloud Build-SA `roles/compute.loadBalancerAdmin` og kjørte ny Cloud Build `2045ba79-d80a-4844-86b6-1e7794c7d43b`. Alle steg (inkl. “Invalidate CDN cache”) fullførte OK; Cloud Run staging ble oppdatert med bildet `cdn-invalidation-test`. | `gcloud projects add-iam-policy-binding ... --role=roles/compute.loadBalancerAdmin`, `gcloud builds submit ... --substitutions _CDN_DRY_RUN=false`, Cloud Build-logg |
| 2025-10-26 | Trinn 6 – Produksjonsklarering | Codex | Kjørte `npm run test:smoke` mot `https://xn--energinkkelen-hnb.no` for å bekrefte at prod-endepunkt, `/config/app.json` og `/metrics` svarer etter siste endringer. | `npm run test:smoke -- --baseUrl=https://xn--energinkkelen-hnb.no` |
| 2025-10-26 | Trinn 6 – Produksjonsklarering | Codex | Satt opp Cloud Monitoring-uptime (`Energinokkelen prod /config`, 5 min, Europa/US-regioner, matcher `apiBaseUrl`) for CDN-domene og la på alert policy `Energinokkelen prod uptime` (utløses når check_passed < 1 i 3 min). Midlertidig e-postvarsel peker til `magnus.lundstein@kli.oslo.kommune.no`. Slack-integrasjon venter på org-approval. | `gcloud monitoring uptime create ...`, `gcloud alpha monitoring policies create --policy-from-file=/tmp/uptime-policy.json`, `gcloud alpha monitoring channels create ... --type=email`, `gcloud alpha monitoring policies update ... --set-notification-channels=...` |

## Neste steg
> Etter hver oppdatering av loggen skal dette avsnittet beskrive hva som gjenstår før neste loggførte trinn, hvem som eier oppgaven og eventuelle blokkere. Oppdateres i takt med fremdriftsloggen og planen over.

- Prod-trafikk (Trinn 6–7): sertifikat `energinokkel-20251025` er aktivt, domenet verifisert i nettleser og Cloud Build-SA har `roles/compute.loadBalancerAdmin`. Klargjør invalidasjon av `prod-frontend-bucket`/`prod-api-backend` før neste prod-deploy. (Magnus + Codex)
- Tilgangskontroll: planlegg autentisering foran Cloud Run (f.eks. Cloud Armor/IAP). Når valgt løsning er satt opp, fjern `roles/run.invoker` for `allUsers` på både prod og staging. (Magnus)
- Monitoring: erstatte midlertidig e-postvarsel med Slack (`#energinøkkelen-monitor`) når kommunen godkjenner appen, og sett opp Playwright/smoke mot prod-URL (API/SPA, metrics). (Codex)
