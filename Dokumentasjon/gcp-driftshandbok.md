# Driftsdokumentasjon – Energinøkkelen i Google Cloud

Oppdatert: 2025-12-06 (Claude)

> Dette dokumentet beskriver Energinøkkelens Google Cloud-miljø, rutiner for bygg/deploy og kjente avvik. Det erstatter `Dokumentasjon/deploy-plan-gcp.md` som “single source of truth” for drift. Oppdater dokumentet hver gang arkitektur, rutiner eller tilgang endres.

---

## 1. Formål og scope

- Oversikt over alle GCP-ressurser som brukes av Energinøkkelen (backend, frontend, innhold).
- Driftsrutiner for daglig oppfølging, deploy, rollback, innholdsoppdateringer og overvåkning.
- Kjenne til kjente gap (IAP/Cloud Armor, Slack-varsler, etc.) slik at de kan planlegges inn.

Miljøet består i dag av ett GCP-prosjekt (`energiverktoy-poc-1234`) med både staging og produksjon i samme prosjekt, men separert via Cloud Build-substitusjoner og Cloud Run-tjenestenavn.

---

## 2. Miljøoversikt

- **Prosjekt-ID:** `energiverktoy-poc-1234`
- **Prosjektnavn:** *Energinoekkelen*
- **Region:** `europe-north1` (Hamina, Finland)
- **Organisasjonstilknytning:** `organizations/99151267823` (Klimaoslo) – flyttet inn 2025-10, bekreftet via `gcloud projects describe`.
- **Miljøer:**
  - **Staging:** Cloud Run-tjeneste `energinokkelen` (URL: `https://energinokkelen-168751968131.europe-north1.run.app`)
  - **Produksjon:** Cloud Run-tjeneste `energinokkelen-prod` (URL: `https://energinokkelen-prod-168751968131.europe-north1.run.app`)
- **Domener:**
  - Offentlig frontend/API: `https://energinøkkelen.no` (`https://xn--energinkkelen-hnb.no`) og `https://energinokkelen.no` (fremtidig alias – ikke registrert).
  - Staging LB IP: `34.111.174.210` (brukes også for prod).
- **Cloud Build triggers:**
  - `energinokkelen-staging` – branch `deploy/gcp`, automatisk deploy til staging.
  - `energinokkelen-prod` – branch `main`, krever manuell approval, deploy til prod.

---

## 3. Arkitektur sammendrag

- **Applikasjon:** tre Node-prosesser pakket i ett multi-container Cloud Run image.
  1. `api-server` (port 8080) – eksponerer REST-endepunkter, proxier metrics og solar, leser runtime content.
  2. `building-info-service` (port 4000) – henter Matrikkel, Enova, CSV, PBE-data og eksponerer `/metrics` + `/health`.
  3. `solar-service` (port 4003) – kommuniserer med PBE Solkart og transformerer soldata.
- **Frontend:** Vite/React build (`dist/`) publiseres til GCS og serveres via global HTTPS load balancer + Cloud CDN. SPA-rewrite håndterer klientruter; `/api/*` rutes via serverless NEG til Cloud Run.
- **Innhold:** JSON/tekstfiler i `content/` publiseres til egen bucket og caches av API-serveren (`/config/app.json`).
- **Secrets:** lastes fra Secret Manager via Cloud Run/Build. Sensitiv konfig (Matrikkel, Enova, PBE).
- **Observability:** Prometheus-metrikker fra building-info-service (eksponert via `/metrics`), Cloud Logging, Cloud Monitoring-uptime check og alert policy for CDN-endepunkt. Managed Service for Prometheus (MSP) mottar nå tidsseriene via sidecar, og standard dashboardet “Cloud Run Monitoring” viser `building_info_service_*`. Det skreddersydde dashboardet “Energinøkkelen – Building Info Observability” må oppdateres til å bruke MSP-navngiving (prefiks `prometheus.googleapis.com/…`) før panelene fungerer. Se kapittel 7 for status og neste steg.
  - Staging har aktiv OTel-sidecar `gmp-collector` (image `otel/opentelemetry-collector-contrib:0.94.0`) som eksporterer `building_info_service_*` til Managed Service for Prometheus. Prod kjører samme konfigurasjon fra 2025-10-30.

---

## 4. Infrastrukturkomponenter

### 4.1 Artifact Registry

- **Repository:** `europe-north1-docker.pkg.dev/energiverktoy-poc-1234/energinokkelen/app`
- Multi-stage Dockerfile bygger image med backend dist og Python-runtime (for scripts).
- Tagging: staging `staging-${SHORT_SHA}`, prod `prod-${SHORT_SHA}` (via Cloud Build-substitusjoner). `latest` brukes for lokal testing.

### 4.2 Cloud Run-tjenester

| Miljø     | Tjeneste                | Konfigurasjon                                                                                                                     | Notater                                                                                                    |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Staging    | `energinokkelen`      | 1 CPU / 1 Gi (api + building-info), 0.5 CPU / 512 Mi (solar).`autoscaling.min=0`, `max=4`. Secrets maps via `valueFrom`. | IAM:`roles/run.invoker` midlertidig gitt til `allUsers` for test. Skal fjernes når auth er på plass. |
| Produksjon | `energinokkelen-prod` | Samme image og env, men `_API_ENV=prod`.                                                                                        | Også åpen for `allUsers` i påvente av Cloud Armor/IAP.                                                |
| Staging    | `energinokkelen-admin` | Node/Express `admin-server` (static build + admin-API). Ingress `internal-and-cloud-load-balancing`, `min=0`/`max=2`, SA `run-energinokkelen-admin`. | Routing via `staging-admin-neg`/`staging-admin-backend`, `/admin`-path i lb + IAP. |
| Produksjon | `energinokkelen-admin-prod` *(planlagt)* | Samme oppsett som staging, men peker mot prod-content/-publisering. | Opprettes når staging/IAM er verifisert. |

**Miljøvariabler (utvalg):**

- `API_ENV` (`test`/`prod`), `API_PORT=8080`
- `BUILDING_INFO_BASE_URL=http://127.0.0.1:4000`, `SOLAR_SERVICE_BASE_URL=http://127.0.0.1:4003`
- `CONTENT_BUCKET`: staging `energinokkelen-content`, prod `energinokkelen-content-prod` (**Viktig:** Prod-tjenesten må bruke `energinokkelen-content-prod` for korrekt staging/prod-separasjon)
- `CONTENT_BUCKET_PREFIX`: default `content` – API-serveren legger til dette prefixet når den leser filer fra GCS (f.eks. `gs://energinokkelen-content/content/tiltak/foo.json`)
- Secrets: `MATRIKKEL_*`, `ENOVA_API_KEY`, `LIVE`, `PBE_*`, `VITE_*`
- Sidecar: OpenTelemetry collector (`gmp-collector`) kjører samme image (`otel/opentelemetry-collector-contrib:0.94.0`) i Cloud Run-tjenesten. Konfig åpen i Secret Manager `run-gmp-config` og oppdateres via `monitoring/run-gmp-config.yaml`. Sidecaren bruker env-variabler `GMP_PROJECT=energiverktoy-poc-1234`, `GMP_LOCATION=europe-north1`, `GMP_CLUSTER=cloud-run-energinokkelen`.

**Avhengigheter:** Cloud Run fetcher runtime content fra GCS ved oppstart (via signed URL eller offentlig bucket). Ingen VPC connector per nå (eksterne APIer åpne).

### 4.3 Secret Manager

Følgende secrets er definert og mappes inn i Cloud Run / Cloud Build:

- `MATRIKKEL_USERNAME`, `MATRIKKEL_PASSWORD`
- `MATRIKKEL_USERNAME_TEST`, `MATRIKKEL_API_BASE_URL_TEST`, `MATRIKKEL_API_BASE_URL_PROD`
- `MATRIKKEL_SNAPSHOT_VERSION`, `MATRIKKEL_SYSTEM_VERSION`
- `ENOVA_API_KEY`
- `LIVE` (styrer om API bruker eksterne systemer)
- `PBE_MAP_BASE_URL`, `PBE_IDENTIFY_TOLERANCE`
- `VITE_API_PROXY_URL`, `VITE_BIS_BASE`
- `IAP_OAUTH_CLIENT_SECRET` (ny 2025-10-29 – opprettet, legg til hemmelighetsversjon med OAuth-klienthemmeligheten)
- (Planlagt) Flere secrets for frontend runtime ved behov.

Rotasjon skjer manuelt via Secret Manager; Cloud Build har `roles/secretmanager.secretAccessor`.

### 4.4 Service accounts og IAM

- **`cloud-build@energiverktoy-poc-1234.iam.gserviceaccount.com`**Roller: `cloudbuild.builds.editor`, `run.admin`, `artifactregistry.writer`, `secretmanager.secretAccessor`, `iam.serviceAccountUser`, `logging.logWriter`, `storage.objectAdmin`, `compute.loadBalancerAdmin`.
- **`run-energinokkelen@energiverktoy-poc-1234.iam.gserviceaccount.com`**Roller: `run.invoker`, `logging.logWriter`, `monitoring.metricWriter`, `secretmanager.secretAccessor`, `storage.objectViewer` (content/data).
- **`run-energinokkelen-admin@energiverktoy-poc-1234.iam.gserviceaccount.com`**Roller: `logging.logWriter`, `monitoring.metricWriter`, `cloudbuild.builds.editor` (for publish-kall), `storage.objectAdmin` på `energinokkelen-content` og `energinokkelen-content-prod`.
- Serverless NEG service agent (`service-168751968131@serverless-robot-prod.iam.gserviceaccount.com`) har `roles/run.invoker` for prod/staging API via load balancer.
- Manuell bruker (Magnus) kjører gcloud-kommandoer; Ocean avhenger av hans IAM (Project Editor).

### 4.5 Cloud Storage og Cloud CDN

| Bucket                           | Miljø  | Formål                        | IAM                                                                                                      |
| -------------------------------- | ------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `energinokkelen-frontend`      | Staging | SPA build (`dist/`)          | Cloud Build SA:`storage.objectAdmin`, LB service agent: `storage.objectViewer`, `allUsers` for CDN |
| `energinokkelen-content`       | Staging | Runtime content (`content/`) | Cloud Build SA (admin), Cloud Run SA (viewer)                                                            |
| `energinokkelen-frontend-prod` | Prod    | SPA build prod                 | Idem, men for prod                                                                                       |
| `energinokkelen-content-prod`  | Prod    | Runtime content prod           | Cloud Run SA (viewer)                                                                                    |
| `energinokkelen-data`          | Felles  | Rådata/CSV/Excel              | Cloud Run SA (viewer)                                                                                    |
| `energinokkelen-build-logs`    | Felles  | Cloud Build loggbucket         | Opprettes automatisk via Cloud Build config                                                              |

`api-server` leser `/config/app.json` direkte fra bøtten (via `CONTENT_BUCKET` + `CONTENT_BUCKET_PREFIX`) og faller tilbake til lokale filer hvis objektet ikke finnes. JSON-en caches per GCS-generation, så oppdatering av filen i bøtten blir synlig uten redeploy.

**Viktig om bucket-struktur:** Alle innholdsfiler ligger i `content/`-undermappen i bøttene:
- Staging: `gs://energinokkelen-content/content/tiltak/*.json`, `gs://energinokkelen-content/content/tilskudd/*.json`
- Prod: `gs://energinokkelen-content-prod/content/tiltak/*.json`, `gs://energinokkelen-content-prod/content/tilskudd/*.json`

API-serveren bruker `CONTENT_BUCKET_PREFIX=content` for å legge til riktig sti når den leser fra GCS.
`deploy/gcp/invalidate-cdn-cache.sh` brukes til å invalidere LB cache etter deploy (via Cloud Build steg).

> Merk: `energinokkelen-content` (staging, opprettet 2025-10-23) og `energinokkelen-content-prod` (prod, opprettet 2025-10-25) er den eneste autoritative lagringen for tiltak- og støtteordningsdata. Begge bøttene har uniform bucket-level access, versjonering og soft delete aktivert. Alle redaktørendringer må først testes i staging-bøtten og bekreftes via staging-frontend/admin før filene kopieres videre til prod (se pilotkravet i `Dokumentasjon/Utvikling/tiltak-innholdsredigering-plan.md`).

### 4.6 Load balancer, CDN og DNS

- **Global HTTPS LB:** `staging-frontend-map` (brukes for både staging/prod hostnames).
  - Backend bucket `staging-frontend-bucket` (staging) og `prod-frontend-bucket` (prod) med host-regler.
  - Serverless NEG `staging-api-neg` / `prod-api-neg` peker til respektive Cloud Run URLer.
  - Path rules:
    - `/api/*`, `/metrics`, `/config/*` → `staging-api-backend` / `prod-api-backend`
    - `/admin` og `/admin/*` → `staging-admin-backend` (staging) og etter hvert `prod-admin-backend`
    - SPA rewrite: forespørsler med `Accept: text/html` → `index.html`
- **Staging host:** `staging.energinøkkelen.no` peker til LB-IP `34.111.174.210`. Lokale QA-testere kan mappe hosten via `/etc/hosts` før testing (prosessen er dokumentert i `Dokumentasjon/innholdsdrift-tiltak.md`). Husk å kjøre `gcloud compute url-maps import staging-frontend-map ...` etter endringer i `deploy/gcp/staging-frontend-map.yaml` for at host-regelen skal aktiveres.
- **IP-adresse:** `34.111.174.210`
- **DNS:** Public sone `energinokkel-no` (`xn--energinkkelen-hnb.no.`) i Cloud DNS. Domeneshop peker NS til Google `ns-cloud-a1…a4`.
- **Sertifikat:** Managed SSL `energinokkel-20251025` (dekker IDN- og ASCII-varianten). Nye sertifikater må opprettes hvis alias-domene registreres.

### 4.7 Cloud Build og CI/CD

- **Konfig:** `deploy/gcp/cloudbuild.yaml`
- **Steg:** `npm ci` → `npm run verify:ci` → `npm run build:prod` → Docker build/push → `gsutil rsync` (`dist/` + `content/`) → CDN invalidasjon → render `cloudrun.yaml` → `gcloud run services replace` (hvis `_DEPLOY=true`).
- **Substitusjoner:** `_REGION`, `_REPOSITORY`, `_FRONTEND_BUCKET`, `_CONTENT_BUCKET`, `_API_ENV`, `_DEPLOY`, `_TAG`, `_SERVICE_NAME`, `_URL_MAP`, `_CDN_PATHS`, `_CDN_DRY_RUN`.
- **Triggers:**
  - Staging: branch `deploy/gcp`, `_DEPLOY=true`, `_API_ENV=test`, `_SERVICE_NAME=energinokkelen`.
  - Prod: branch `main`, `_DEPLOY=true`, `_API_ENV=prod`, `_SERVICE_NAME=energinokkelen-prod`, krever approval.
- **Manuelle kjøringer:** `gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions ...`

### 4.8 Monitoring og logging

- **Prometheus-metrikker:** `building_info_service_*` fra building-info-service (`/metrics`). Dokumentert i `Dokumentasjon/Utvikling/prometheus-metrikker.md`.
- **Cloud Monitoring:**
  - Uptime check: `Energinokkelen prod /config` (5 min, EU/US regioner, validerer `apiBaseUrl` i respons).
  - Alert policy: `Energinokkelen prod uptime` – trigges hvis `check_passed < 1` i 3 min.
  - Notification channels: e-post `magnus.lundstein@kli.oslo.kommune.no` og Slack-webhook `projects/energiverktoy-poc-1234/notificationChannels/2903429056188648583` (peker til `#energinøkkelen-monitor`, token legges som query-param).
  - For nye kanaler: bruk Slack-app med incoming webhook og legg til ny channel via `gcloud alpha monitoring channels create --type=webhook_tokenauth`.
  - **GCP-kommandoer testet 2025-10-30:**
    - `gcloud alpha monitoring dashboards describe 212a526e-cf17-4199-860c-c4c8e9179127 --project energiverktoy-poc-1234` – fungerer, brukes for å hente `etag` før oppdatering.
    - `gcloud alpha monitoring dashboards update 212a526e-cf17-4199-860c-c4c8e9179127 --config-from-file monitoring/building-info-dashboard.json --project energiverktoy-poc-1234` – fungerer når `etag` i JSON samsvarer med sist leste verdi.
    - `CLOUDSDK_CONFIG=$PWD/.gcloud gcloud secrets versions add run-gmp-config --data-file monitoring/run-gmp-config.yaml --project energiverktoy-poc-1234` – oppretter ny konfigversjon for sidecar.
    - `CLOUDSDK_CONFIG=$PWD/.gcloud gcloud builds submit --config deploy/gcp/cloudbuild.yaml --substitutions _TAG=manual-gmp-fix-$(date +%Y%m%d%H%M%S) --project=energiverktoy-poc-1234` – kjører staging deploy med oppdatert substitusjon (`_GMP_CONFIG_VERSION=5`).
    - `CLOUDSDK_CONFIG=$PWD/.gcloud gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=\"energinokkelen\" AND resource.labels.container_name=\"gmp-collector\"" --project=energiverktoy-poc-1234 --freshness=7d --limit=50 --format=json` – bekrefter at collector-logging er tom (ingen feil).
    - `CLOUDSDK_CONFIG=$PWD/.gcloud bash -lc 'TOKEN=$(gcloud auth print-access-token); curl -s -G -H "Authorization: Bearer $TOKEN" --data-urlencode "query=building_info_service_external_requests_total{cluster=\"cloud-run-energinokkelen\"}" https://monitoring.googleapis.com/v1/projects/energiverktoy-poc-1234/location/europe-north1/prometheus/api/v1/query_range'` – viser tidsserier via Prometheus API (bruk `query_range` med `start/end/step` parametre som nødvendig).
    - `CLOUDSDK_CONFIG=$PWD/.gcloud bash -lc 'TOKEN=$(gcloud auth print-access-token); curl -s -G -H "Authorization: Bearer $TOKEN" --data-urlencode "filter=metric.type=\"prometheus.googleapis.com/building_info_service_external_requests_total/counter\"" --data-urlencode "interval.startTime=$(date -u -d \"10 minutes ago\" +%Y-%m-%dT%H:%M:%SZ)" --data-urlencode "interval.endTime=$(date -u +%Y-%m-%dT%H:%M:%SZ)" https://monitoring.googleapis.com/v3/projects/energiverktoy-poc-1234/timeSeries'` – bekrefter datapunkter via Monitoring API.
    - `gcloud alpha monitoring policies create --policy-from-file monitoring/building-info-alert-*.json --project energiverktoy-poc-1234 --no-enabled` – validerer PromQL, men feiler fortsatt (`INVALID_ARGUMENT`) fordi CLI ikke aksepterer MSP-prefiksede metrikknavn.
    - `gcloud alpha monitoring policies delete <policy>` og `gcloud alpha monitoring policies list --project energiverktoy-poc-1234 --filter "displayName~Energinokkelen"` – fungerer for å rydde opp etter testpolicyer og hente eksisterende.
    - `curl https://monitoring.googleapis.com/v1/projects/energiverktoy-poc-1234/location/global/prometheus/api/v1/label/__name__/values` (med `gcloud auth print-access-token`) – nødvendig for metrikknavn, fordi `gcloud monitoring metrics ...`/`gcloud alpha monitoring metric-descriptors ...` ikke er tilgjengelige i CLI.
- **Logging:** Cloud Run standard logging til Cloud Logging. API/solar/building-info loggfører basishendelser.
- **Dashboards:** Standard “Cloud Run Monitoring” viser `building_info_service_*` etter MSP-utrulling. Det skreddersydde `Energinøkkelen – Building Info Observability` eksisterer, men panelene må oppdateres til å bruke MSP-navn (prefiks `prometheus.googleapis.com/…`) før data vises. Se avsnitt 7 for videre arbeid.

### 4.9 Automatiserte skript

- `deploy/gcp/invalidate-cdn-cache.sh` – brukes av Cloud Build til å invalidere CDN (`_CDN_PATHS` kan settes).
- `scripts/test-api-smoke.ts` – lokal/staging/prod smoke (brukes i CI og manuelt).
- Andre scripts for data (Python) – foreløpig manuelt trigget.

### 4.10 Admin-build og deploy (staging)

- **Cloud Build-konfig:** `deploy/gcp/cloudbuild-admin.yaml`
- **Formål:** Bygger admin-UI med `VITE_BASE_PATH=/admin/` og oppdaterer Cloud Run-tjenesten `energinokkelen-admin`. Beholder eksisterende staging-trigger for bruker-frontend upåvirket.
- **Standard substitutions:**
  - `_REGION=europe-north1`
  - `_REPOSITORY=energinokkelen`
  - `_SERVICE_NAME=energinokkelen-admin`
  - `_TAG=admin-latest` (kan overskrives for manuell tagging, f.eks. `_TAG=admin-$(date +%Y%m%d%H%M%S)`)
  - `_VITE_BASE_PATH=/admin/`
- **Kjøring (manuell fra repo-root):**
  ```bash
  gcloud builds submit \
    --config deploy/gcp/cloudbuild-admin.yaml \
    --substitutions _TAG=admin-$(date +%Y%m%d%H%M%S)
  ```
  (Trigger i GCP bør peke på branch `deploy/gcp` og bruke samme konfig/substitusjoner.)
- **Routing:** LB path `/admin` går til `staging-admin-backend` (Cloud Run `energinokkelen-admin`). Med `base=/admin/` peker index til `/admin/assets/**`, som serveres fra admin-serveren og unngår 404 mot GCS-bucketen.
- **Trigger-oppsett:** Trigger `energinokkelen-admin-staging` er opprettet i `europe-north1` med:
  - Repo-tilkobling: `projects/energiverktoy-poc-1234/locations/europe-north1/connections/energinokkelen-conn/repositories/poc-energiradgivning`
  - Branch filter: `^deploy/gcp$`
  - Build config: `deploy/gcp/cloudbuild-admin.yaml`
  - Substitusjoner: `_TAG=admin-latest` (kan overstyres)

---

## 5. Operasjonelle rutiner

### 5.1 Bygg og deploy

1. **Staging:** bruk `git push` til branch `deploy/gcp` → Cloud Build staging trigger.
   - Verifiser i Cloud Build UI at `npm run verify:ci`, build og deploy passerte.
   - Smoke-test staging: `npm run test:smoke -- --baseUrl=https://energinokkelen-168751968131.europe-north1.run.app`.
2. **Prod:** merge til `main` → Cloud Build prod trigger stopper for approval.
   - Kontroller staging først, godkjenn Cloud Build jobben.
   - Etter deploy: verifiser `https://energinøkkelen.no/config/app.json`, `/metrics`, og run `npm run test:smoke -- --baseUrl=https://xn--energinkkelen-hnb.no`.

### 5.2 Innholdsoppdateringer uten kodeendring

- Oppdater JSON/YAML lokalt og synk til GCS (`gsutil -m rsync content gs://energinokkelen-content` for staging, `...-content-prod` for prod). API-serveren leser direkte fra bøtten; redeploy trengs ikke.
- 2025-11-13: Nye runtime-filer (`content/tiltak/etterisolering-kjeller-loft.json`, `content/tilskudd/klimaoslo-fasadefond.json`, `content/tilskudd/enova-etterisolering-loft-kjeller.json`) ligger i repoet. Synk dem til staging først; publiser til prod når metadata.status settes til `published` og driftsloggen er oppdatert.
- 2025-11-13: Solenergi/Varmepumpe er migrert til `content/tiltak/solenergi.json` og `content/tiltak/varmepumpe.json` + nye tilskudd (`klimaoslo-solenergitilskudd`, `enova-solcelleanlegg`, `klimaoslo-vaeske-til-vann-varmepumpe`, `klimaoslo-varmepumpebereder`). Husk å rsync begge bøtter og oppdatere metadata-status før prod-republisering.
- 2025-11-14: Tetting/Ventilasjon/Vinduer er lagt inn som `content/tiltak/{tetting,ventilasjon,vinduer}.json` (inkl. `variants` for gul liste) og nye tilskudd (`klimaoslo-oppgradering-bygningskropp`, `klimaoslo-energitiltak-borettslag`, `klimaoslo-energikartlegging-borettslag`, `klimaoslo-balansert-ventilasjon`, `klimaoslo-vinduer-dorer`, `enova-energiradgivning`, `byantikvaren-istandsetting`). Filene står som `draft` i metadata og må godkjennes + rsynces før de brukes i prod.
- For større innholdsendringer kan Cloud Build brukes (kjør staging/prod trigger eller `gcloud builds submit --substitutions _DEPLOY=false` for kun artefakter).
- Husk eventuelt å invalidere CDN dersom frontend skal lese nye filer direkte (`deploy/gcp/invalidate-cdn-cache.sh`).
- Tiltakstekster og lignende innhold ligger i `content/tiltak/*.json` og hentes via `/config/content/<sti>.json`. Filer leses først fra GCS-bøtten og faller tilbake til lokale filer.
- Fra 2025-11-12 validerer API-serveren automatisk alle `content/tiltak/*.json` og `content/tilskudd/*.json` som har `schemaVersion`. Upubliserte/arkiverte dokumenter returnerer 404/410 i prod, og ugyldige filer gir `422` med detaljer i Cloud Logging. Bruk `?draft=1` når redaktører skal forhåndsvise staging-data.
- `/config/content/tiltak/index.json` og `/config/content/tilskudd/index.json` genereres on-demand og oppsummerer antall publiserte elementer, samt hvor mange som hoppes over (legacy/ugyldig/upublisert). Admin-løsningen skal benytte disse indeksene fremfor å scanne bøtten manuelt.
- Alle `/config/content/**`-endepunktene returnerer nå `ETag`-headere basert på GCS `generation` (eller filsystemets mtime/size), og støtter `If-None-Match` slik at admin-klienten kan oppdage race conditions og unngå overstyring.
- Første pilot med nytt schema (`etterisolering-yttervegg`) er supplert med `etterisolering-kjeller-loft`, `solenergi` og `varmepumpe` som nå brukes direkte i frontenden via `useTiltakContent`/`useGrantAwareStotteordninger`.
- 2025-11-13: `npm run content:validate` og `npm run content:publish -- <push-staging|promote>` automatiserer schema-validering og staging→prod-synk. Rutinen er beskrevet i `Dokumentasjon/innholdsdrift-tiltak.md`; kjøres før redaktører tester via `staging.energinøkkelen.no`.

### 5.3 CDN-invalidator

- Scriptet kjøres automatisk når `_DEPLOY=true`.
- Manuell kjøring:
  ```
  PROJECT_ID=energiverktoy-poc-1234 ./deploy/gcp/invalidate-cdn-cache.sh staging-frontend-map
  ```

  Sett `CDN_PATHS` for selektiv invalidasjon.

### 5.4 Rollback-prosedyrer

- **Cloud Run:** `gcloud run services list-revisions --region europe-north1 --service energinokkelen(-prod)` → `gcloud run services update-traffic ... --to-revisions <REV>=100`.
- **Frontend/content:** `gsutil rsync` fra `gs://...` versjon (bruk `gsutil ls -al` for objekthistorikk) eller gjenopprett via `gcloud storage objects restore`.
- **DNS/LB:** Om nødvendig, revert `url-map` via `gcloud compute url-maps import`.

### 5.5 Testing og verifikasjon

- `npm run verify` lokalt før PR.
- `npm run test:smoke` mot ønsket baseUrl (bruk `--baseUrl`).
- `npm run test:full-chain` (krever nettverkstilgang til eksterne apier). For sandkasse: `SOLAR_SERVICE_MOCK=1`.
- Prod monitoring: se uptime check + planlagt Playwright syntetisk test (TODO).

### 5.6 Secrets og nøkler

- Rotasjon: oppdater Secret Manager med ny versjon (`gcloud secrets versions add`). Cloud Run henter siste versjon automatisk ved redeploy.
- Hold `MATRIKKEL_*` og `ENOVA_API_KEY` synkronisert med leverandør. Logg endringer i dette dokumentet.
- IAP-klient: sørg for at `IAP_OAUTH_CLIENT_SECRET` har aktiv versjon og begrens tilgang til driftskontoer.
  - Tilgang pr. 2025-10-29: `user:magnus.lundstein@klimaoslo.no`, `serviceAccount:cloud-build@energiverktoy-poc-1234.iam.gserviceaccount.com`, `serviceAccount:run-energinokkelen@energiverktoy-poc-1234.iam.gserviceaccount.com`.
- IAP-klient: sørg for at `IAP_OAUTH_CLIENT_SECRET` har aktiv versjon og begrens tilgang til driftskontoer.

### 5.7 Backup og datahåndtering

- Rådata i `energinokkelen-data` bør tas jevnlige eksportkopier (gsutil + Cloud Scheduler/lifecycle).
- Dokumenter eventuelle Excel/CSV-oppdateringer i `Dokumentasjon/` og hold `data/raw/` under versjonskontroll.

### 5.8 Admin-API og innholdspublisering

- **Kodebase:** `services/admin-api/*` (Express) + `src/admin/*` (frontend). Lokalt startes APIet via `npm run dev:admin-api` (port `4100` som default).
- **Endepunkt:** `POST /admin/api/publish` (se § 9.7 i `Dokumentasjon/innholdsdrift-tiltak.md`). Prod/staging ligger bak IAP slik at bare gruppen `energinokkel-redaktor@klimaoslo.no` kan kalle det.
- **Cloud Build-kall:** API-et anroper `https://cloudbuild.googleapis.com/v1/projects/$PROJECT/locations/$LOCATION/builds` direkte med `GoogleAuth`. Builden består av 2 steg:
  1. `gsutil -m rsync -d -r $STAGING_BUCKET $PROD_BUCKET`
  2. Python-script som skriver `publish-log.json` med metadata (`user`, `changeSummary`, `items`, `gitSha`, `requestId`, `triggeredAt`) til `gs://energinokkelen-content-prod/content/logs/publish-<timestamp>.json`
- **Servicekontoer/roller:** Cloud Build-publiseringsjobben kjører som `cloud-build@energiverktoy-poc-1234.iam.gserviceaccount.com`. Denne har `roles/storage.objectAdmin` på både `energinokkelen-content` og `energinokkelen-content-prod`. Admin-API (som kjører som `run-energinokkelen-admin@...`) trenger `roles/cloudbuild.builds.editor` for å opprette jobben, samt `roles/iam.serviceAccountUser` på `cloud-build@...` for å kunne spesifisere servicekontoen i Cloud Build-jobben.
- **Konfigurasjon:** styres av
  | Variabel | Default | Notat |
  | --- | --- | --- |
  | `ADMIN_CLOUD_BUILD_PROJECT` | `GOOGLE_CLOUD_PROJECT` | Prosjekt-id for builden |
  | `ADMIN_CLOUD_BUILD_LOCATION` | `global` | Cloud Build region |
  | `ADMIN_CONTENT_STAGING_PREFIX` | `gs://energinokkelen-content` | Kildebucket (**NB:** uten `/content`-suffix) |
  | `ADMIN_CONTENT_PROD_PREFIX` | `gs://energinokkelen-content-prod` | Målbucket (**NB:** uten `/content`-suffix) |
  | `ADMIN_CONTENT_LOG_PREFIX` | `gs://energinokkelen-content-prod/logs` | Audit-logger |
  | `ADMIN_CONTENT_PUBLISHER_SERVICE_ACCOUNT` | `cloud-build@…` | SA for build-stepene |
- **Monitoring & verifikasjon:**
  - Cloud Build-tag `content-publish` gjør det enkelt å filtrere i konsollen (`Cloud Build → History → filter tag:content-publish`).
  - Hvert build-svar inneholder `logUrl` og `buildId` – eksponeres tilbake til frontend slik at redaktørene kan følge jobben.
  - Publiseringsloggene i `gs://energinokkelen-content-prod/content/logs` inneholder `requestId`, `initiatedBy`, `items[]`, `gitSha` og `dryRun`.
- **Manuell kjøring:** For hurtigtest uten IAP, bruk servicekonto eller `gcloud auth print-identity-token` og kall API-et direkte:
  ```bash
  TOKEN=$(gcloud auth print-identity-token)
  curl -X POST https://<admin-run-url>/admin/api/publish \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"changeSummary":"Publiserer solenergi + Enova","items":[{"id":"solenergi","collection":"tiltak"},{"id":"enova-solcelleanlegg","collection":"tilskudd"}]}'
  ```
- **Feilsøking:** Sjekk Cloud Build-loggen først. Dersom builden ikke opprettes: verifiser at Cloud Run-servicekontoen har `roles/cloudbuild.builds.editor`. Dersom build steg 1 feiler, kjør `gcloud storage cat gs://energinokkelen-content-prod/content/logs/publish-*.json` for å se hvilken bruker/forespørsel som trigget jobben.

### 5.9 Incident response

- Sjekk Cloud Monitoring alert (e-post/Slack).
- Gå til Cloud Run logs (`gcloud run services logs read energinokkelen --region europe-north1`).
- For eksterne avhengigheter: se Prometheus-metrikker (`building_info_service_external_*`).
- Noter hendelsen i dette dokumentet og eventuelt i teamets incidents-tracker.

---

## 6. Sikkerhet og tilgang

- **Organisasjon:** Prosjektet er nå knyttet til `organizations/99151267823`, identifisert som Klimaoslo (`displayName: klimaoslo.no`). Organisasjonen ble etablert 2025-10-28 og har kunde-ID `C03q5c8qi`.
- **Per nå:** Cloud Run-tjenestene ble 2025-10-29 konfigurert med ingress `internal-and-cloud-load-balancing`, og `allUsers`-bindinger ble fjernet (kun LB-servicekontoen står igjen i prod).
- **Autentisering/sikring (status 2025-11-18):**

  - IAP-brand og klient (`projects/168751968131/brands/168751968131`, klient-ID `168751968131-3rt5l26aj6febgetbtmals5s5rk7gk85.apps.googleusercontent.com`) beskytter nå `staging-admin-backend` (Cloud Load Balancer). Tilgang er gitt til Workspace-gruppen *Energinøkkel-redaktør* (`energinokkel-redaktor@klimaoslo.no`). Prod-backendene (`energinokkelen`, `energinokkelen-prod`, `prod-admin-backend`) holder fortsatt `allUsers` inntil IAM/IAP kan strammes.
  - Cloud Armor-policy `energinokkelen-armor` er opprettet, men ikke aktiv på backendene ennå (forrige forsøk ga 403 – må feilsøkes før reaktivering). Planlagt kost: ~USD 23/mnd + USD 0.10 per million forespørsler (≈USD 0.005 ved 50 000 kall).
- **Slack varsler:** Slack-app med incoming webhook er satt opp for `#energinøkkelen-monitor` (notification channel `projects/energiverktoy-poc-1234/notificationChannels/2903429056188648583`). Cloud Monitoring sender nå varsler til både e-post og Slack.
- **GitHub-integrasjon:** Cloud Build connection `energinokkelen-conn` er satt opp med nødvendige rettigheter.
- **Tilgangsstyring:** bruk IAM-roller `viewer`, `developer`, `release` for teamet. Unngå å dele nøkler uten logging.
- **DNS/domene:** `energinøkkelen.no` er IDN. Kommunens sikkerhetspolicy må whitelist’e punycode-domenet for å unngå blokkering i organisasjonens nett.
- **Aktiverte APIer:** Cloud Resource Manager API slått på 2025-10-29 (krav fra orgpolicy for IAP IAM-bindinger).
- **Prosjektroller:**  

  | Identitet                                                                            | Roller                                                                                                                                           | Kommentar                                                                                                     |
  | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
  | `user:magnus.lundstein@kli.oslo.kommune.no`                                        | `roles/owner`                                                                                                                                  | Primær administrator, eneste menneskelige eier i prosjektet.                                                 |
  | `user:magnus.lundstein@klimaoslo.no`                                               | `roles/resourcemanager.projectIamAdmin`, `roles/resourcemanager.projectMover`                                                                | Samme person med Klimaoslo-identitet brukt til å flytte prosjektet inn i organisasjonen og administrere IAM. |
  | `serviceAccount:cloud-build@energiverktoy-poc-1234.iam.gserviceaccount.com`        | Cloud Build + deployroller (`roles/cloudbuild.*`, `roles/run.admin`, `roles/storage.objectAdmin`, `roles/iam.serviceAccountUser`, m.fl.) | Brukes av CI/CD-pipeline.                                                                                     |
  | `serviceAccount:run-energinokkelen@energiverktoy-poc-1234.iam.gserviceaccount.com` | `roles/artifactregistry.reader`, `roles/logging.logWriter`, `roles/monitoring.metricWriter`, `roles/secretmanager.secretAccessor`        | Kjører Cloud Run-tjenestene.                                                                                 |
  | Plattformservicekontoer (`gcp-sa-*/serverless-robot/compute-system`)               | Tjenestespesifikke `roles/*serviceAgent`                                                                                                       | Automatisk provisjonert av GCP for drift.                                                                     |
- Ingen ytterligere brukere eller grupper er tilknyttet per 2025-10-28. Bruk tabellen som utgangspunkt når egne IAM-roller skal defineres.
- **Organisasjonsroller (Klimaoslo):**  

  | Identitet                                      | Roller                                                                                                                                                                                                                                                                   | Kommentar                                                                                                                       |
  | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
  | `user:magnus.lundstein@klimaoslo.no`         | `roles/resourcemanager.organizationAdmin`, `roles/resourcemanager.organizationViewer`, `roles/resourcemanager.projectCreator`, `roles/resourcemanager.projectMover`                                                                                              | Full org-administrasjon, prosjektflytting.                                                                                      |
  | `group:gcp-organization-admins@klimaoslo.no` | `roles/resourcemanager.organizationAdmin`, `roles/iam.organizationRoleAdmin`, `roles/resourcemanager.folderAdmin`, `roles/orgpolicy.policyAdmin`, `roles/cloudkms.admin`, `roles/cloudsupport.admin`, `roles/pubsub.admin`, `roles/securitycenter.admin` | Org-admin-gruppe (inkluderer Magnus).                                                                                           |
  | `group:gcp-billing-admins@klimaoslo.no`      | `roles/billing.admin`, `roles/billing.creator`, `roles/resourcemanager.organizationViewer`                                                                                                                                                                         | Fakturering og org-visning.                                                                                                     |
  | `domain:klimaoslo.no`                        | `roles/billing.creator`, `roles/resourcemanager.projectCreator`                                                                                                                                                                                                      | Alle brukere i domenet kan opprette prosjekter og billing – vurder om dette skal strammes inn før flere brukere får tilgang. |

---

## 7. Kjent gjøremålsliste

1. **Managed Prometheus-sidecar – status 2025-10-30:**
   - Staging (`energinokkelen`) og prod (`energinokkelen-prod`) kjører `otel/opentelemetry-collector-contrib:0.94.0` som sidecar (`gmp-collector`). Konfig lagres i Secret Manager `run-gmp-config` (versjon 5) og mountes til `/etc/rungmp/config.yaml`.
   - Collector-konfig (`monitoring/run-gmp-config.yaml`) skraper `127.0.0.1:8080/metrics` (API-serveren eksponerer `building-info-service`-metrikkene direkte), oppdaterer resource-attributter (cluster, location, project_id) og eksporterer til Managed Service for Prometheus.
   - Miljøvariabler per sidecar: `GMP_PROJECT`, `GMP_LOCATION=europe-north1`, `GMP_CLUSTER=cloud-run-energinokkelen(-prod)`, `GMP_CONFIG_VERSION=5`. `run.googleapis.com/container-dependencies` sikrer at collector starter etter `building-info-service`, og liveness-proben på `/healthz` er aktiv.
   - Verifisering 2025-10-30: `projects/energiverktoy-poc-1234/timeSeries?filter=metric.type="prometheus.googleapis.com/building_info_service_external_requests_total/counter"` returnerer datapunkter for både staging og prod (bekreftet via Monitoring API). Tilsvarende tidsserier er synlige via Prometheus API (`.../prometheus/api/v1/query_range`) med rånavn (`building_info_service_external_requests_total`), både for `cluster=cloud-run-energinokkelen` og `cluster=cloud-run-energinokkelen-prod`.
   - Cloud Build-template (`deploy/gcp/cloudbuild.yaml`) setter `_GMP_LOCATION`, `_GMP_CLUSTER`, `_GMP_CONFIG_VERSION`; `_CONTENT_BUCKET_NAME` brukes for å rendere miljøspesifikk bøtteverdi under deploy.
   - Alert-policy maler for staging/prod ligger i `monitoring/building-info-alert-*.json` og peker nå på MSP-navn (`prometheus.googleapis.com/...`). CLI-validering blokkerer fortsatt provisjonering.
   - **Oppdatert 2025-10-30:** Dashboardet er konvertert til `prometheus.googleapis.com/...`-navn med eksplisitte `cluster`-filtre for staging/prod, og re-deployet via `gcloud alpha monitoring dashboards update --config-from-file monitoring/building-info-dashboard.json --dashboard=212a526e-cf17-4199-860c-c4c8e9179127`.
   - **Alert-maler 2025-10-30:** `monitoring/building-info-alert-*.json` er oppdatert til MSP-navn, med separate filer for staging/prod og eksplisitt `cluster`-filter.
   - **Validering 2025-10-30:** `gcloud alpha monitoring policies create --policy-from-file monitoring/building-info-alert-*.json --no-enabled` feiler fortsatt (`INVALID_ARGUMENT`) fordi CLI bruker Prometheus APIet som ikke godtar `prometheus.googleapis.com/*`. Tidsseriene finnes i Monitoring API.
   - **Neste steg:**
     1. Prod: Sett `_GMP_CONFIG_VERSION=5` i prod-deploy (Cloud Build substitusjon) og kjør ny `gcloud builds submit ...` for `energinokkelen-prod`, eller manuelt oppdater Cloud Run til å bruke secret versjon 5. Bekreft med `curl https://energinokkelen-prod.../metrics`.
     2. Alert-policyer: Opprett staging/prod-policyer via Cloud Monitoring API eller konsollen (bruk `projects.locations.global.alertPolicies.create`), dokumenter nøyaktig fremgangsmåte i avsnitt 4.8 og aktiver varslene.
     3. Etter policy-opprettelse, oppdater dashboard/alerts hvis vi renamer cluster-labels eller endrer metrikker.

2. **Cloud Armor / ingress – ferdigstilt 2025-10-30:**
   - Org-policy `constraints/iam.allowedPolicyMemberDomains` er satt til `allValues: ALLOW` av klimaoslo-kontoen for å muliggjøre offentlige invoker-bindinger.
   - `roles/run.invoker` med `allUsers` er gjeninnført på `energinokkelen` og `energinokkelen-prod`; verifisert via `gcloud run services get-iam-policy`.
   - Cloud Armor-policy `energinokkelen-armor` holder seg aktiv; siste LB-loggutdrag (`resource.type="http_load_balancer"`) viser kun 200/404-responser etter endringen, ingen nye 401/403 observert. Følg opp `compute.googleapis.com/security_policy`-loggen ved mistanke om blokkeringer.

3. **Dashboards – ferdigstilt 2025-10-30:**
   - Cloud Monitoring-dashboard `Energinøkkelen – Building Info Observability` (ID `212a526e-cf17-4199-860c-c4c8e9179127`), konfigurert via `monitoring/building-info-dashboard.json`.
   - Visualiserer lookup-helse, eksterne avhengnader, cache-rate og datakvalitet basert på `building_info_service_*`-metrics.
   - Oppdater dashboardet ved å redigere JSON-filen og kjøre `gcloud monitoring dashboards update --config-from-file monitoring/building-info-dashboard.json --dashboard=212a526e-cf17-4199-860c-c4c8e9179127`.

4. **Playwright/syntetisk test:** automatisere frontend smoke mot CDN.
5. **Scheduler/tilskudd-jobb:** automatisere oppdatering av `tilskudd.json` (planlagt Cloud Scheduler/Cloud Function).
6. **Content governance:** dokumentere rutine for akutt innholdsoppdatering + rollback (gsutil versioning).
7. **Excel-validering:** script for å validere kolonneendringer før synk (nevnt som åpen oppgave).
8. **Prod CDN invalidasjon:** utvide Cloud Build til også å invalidere `prod-frontend-bucket` ved prod deploy (krever substitusjon og `--service-account` rettigheter).

Hold listen oppdatert og kryss av etter hvert som tiltakene er implementert.

---

## 8. Referansekommandoer

```bash
# Endre aktivt prosjekt (hvis flere er autentisert)
gcloud config set project energiverktoy-poc-1234

# Liste Cloud Run-tjenester og revisjoner
gcloud run services list --region europe-north1
gcloud run services list-revisions --region europe-north1 --service energinokkelen-prod

# Deploy manuell bygg (eks staging test)
gcloud builds submit --config deploy/gcp/cloudbuild.yaml \
  --substitutions _TAG=manual-test,_DEPLOY=true,_API_ENV=test

# Invalidate CDN (manuelt)
PROJECT_ID=energiverktoy-poc-1234 ./deploy/gcp/invalidate-cdn-cache.sh staging-frontend-map

# Oppdatere alert policy notification channels
gcloud alpha monitoring channels list
gcloud alpha monitoring policies update PROJECTS/.../alertPolicies/ID \
  --set-notification-channels=projects/PROJECT/notificationChannels/ID

# Uptime check status
gcloud monitoring uptime list-configs
gcloud monitoring uptime describe projects/energiverktoy-poc-1234/uptimeCheckConfigs/...
```

---

## 9. Endringslogg

| Dato       | Beskrivelse                                                                                                                                                                      | Utført av |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2025-11-27 | **Staging/prod-separasjon fikset:** (1) Endret `CONTENT_BUCKET` i `energinokkelen-prod` til `energinokkelen-content-prod`, (2) La til `/config/content/*` proxy i admin-server for staging-preview, (3) Endret `ADMIN_CONTENT_PROD_PREFIX` til `gs://energinokkelen-content-prod` (uten `/content`-suffix). Admin-server serverer nå forhåndsvisning fra staging-bøtten. | Claude |
| 2025-12-06 | **GCS bucket-struktur og prefix-fix:** (1) La til `CONTENT_BUCKET_PREFIX=content` i api-server.ts slik at filer leses fra `gs://bucket/content/tiltak/*.json` i stedet for root-nivå, (2) Oppdaterte `ADMIN_CONTENT_STAGING_PREFIX` og `ADMIN_CONTENT_PROD_PREFIX` i admin-tjenesten til å inkludere `/content`-suffix (`gs://energinokkelen-content/content`), (3) Slettet legacy-filer fra rot-nivå i staging-bøtten og kopierte tilskudd/dictionaries til `content/`-undermappen, (4) Fikset `CONTENT_BUCKET` i prod-tjenesten fra `energinokkelen-content` til `energinokkelen-content-prod` for korrekt miljøseparasjon. | Claude |
| 2025-11-26 | **Publiserings-wizard ferdig:** Fikset servicekonto fra `content-admin@` til `cloud-build@`, la til IAM-binding `serviceAccountUser`, oppdatert Cloud Run env-var. Endret prod-frontend `CONTENT_BUCKET` til `energinokkelen-content-prod` for korrekt staging/prod-separasjon. | Claude |
| 2025-11-15 | Temperaturstyring flyttet til `content/tiltak/temperaturstyring.json` med variantdata + nye tilskudd (`klimaoslo-smart-energistyring`, `klimaoslo-pris-effektstyring`) dokumentert i content-/driftsrutinene. | Codex      |
| 2025-11-13 | Dokumenterte staging-host (`staging.energinøkkelen.no`) i LB-oppsettet, og beskrev nye innholdsskript (`content:validate`/`content:publish`) samt driftsrutinen i `Dokumentasjon/innholdsdrift-tiltak.md`. | Codex      |
| 2025-11-13 | Solenergi/Varmepumpe flyttet til `content/tiltak/*.json` + nye tilskudd (`klimaoslo-solenergitilskudd`, `enova-solcelleanlegg`, `klimaoslo-vaeske-til-vann-varmepumpe`, `klimaoslo-varmepumpebereder`), `useGrantAwareStotteordninger` dokumentert og rutiner for rsync/metadata oppdatert. | Codex      |
| 2025-11-14 | Tetting/Ventilasjon/Vinduer modellert i `content/tiltak/*.json` (inkl. gul-listevarianter) og nye tilskudd (`klimaoslo-oppgradering-bygningskropp`, `klimaoslo-energitiltak-borettslag`, `klimaoslo-energikartlegging-borettslag`, `klimaoslo-balansert-ventilasjon`, `klimaoslo-vinduer-dorer`, `enova-energiradgivning`, `byantikvaren-istandsetting`) lagt til dokumentasjonen. | Codex      |
| 2025-11-13 | Lagt til nye content-filer (etterisolering kjeller/loft + to tilskudd), dokumentert at frontend henter støtteordninger via `useTilskuddBatch`, og oppdatert Oppdatert-linjen. | Codex      |
| 2025-11-12 | Noterte at `etterisolering-yttervegg`/`enova-etterisolering` ligger i repoet som første pilot på nytt schema og hentes i frontenden via `useTiltakContent`. | Codex      |
| 2025-11-12 | La til `ETag/If-None-Match`-støtte for `/config/content/**`-endepunktene slik at klientene kan cache og gjøre optimistisk låsing på innholdsoppdateringer.                        | Codex      |
| 2025-10-30 | Migrerte `monitoring/building-info-alert-*.json` til MSP-metrikker, validerte med `gcloud alpha monitoring policies create` (feilet pga. manglende `building_info_service_*`-metrikk i MSP) og dokumenterte videre tiltak. | Codex      |
| 2025-10-30 | Oppdaterte `monitoring/building-info-dashboard.json` til Managed Prometheus-navngiving med eksplisitte cluster-filtre og deployet dashboardet i GCP.                              | Codex      |
| 2025-10-30 | Dokumenterte at MSP-metrikker er synlige i “Cloud Run Monitoring”, la til videre tiltak for dashboard/alert-konfig og oppdaterte observability-seksjonen. | Codex      |
| 2025-10-30 | Verifiserte Prometheus-tidsserier i MSP, oppdaterte `run-gmp-config` til versjon 4 med miljøvariabler og parameteriserte Cloud Build for cluster/versjons-substitusjoner. | Codex      |
| 2025-10-30 | Gjenåpnet Cloud Run for `allUsers` etter org-policy justering, etablerte Cloud Monitoring-dashboard for building-info-service og oppdaterte driftsdokumentasjon. | Codex      |
| 2025-10-29 | Strammet Cloud Run ingress, fjernet `allUsers`, opprettet IAP-brand/klient, la til Slack-varsling via webhook, forberedte Cloud Armor (krever videre testing før aktivering). | Codex      |
| 2025-10-28 | Kartla organisasjonens IAM (Klimaoslo), dokumenterte orgroller og oppdaterte sikkerhetsstatus etter innflytting.                                                                 | Codex      |
| 2025-10-27 | Kartla organisasjonstilknytning (Klimaoslo) og nåværende IAM-brukere/servicekontoer.                                                                                           | Codex      |
| 2025-10-26 | Første versjon – samlet driftsinformasjon, rutiner og åpne punkter. Erstatter `deploy-plan-gcp.md` som SSOT.                                                                | Codex      |

---

**Vedlikehold:** Oppdater dokumentet etter hver endring i GCP-infrastruktur, pipelines, sikkerhet eller rutiner. Husk å justere “Oppdatert”-linjen og endringslogg.
