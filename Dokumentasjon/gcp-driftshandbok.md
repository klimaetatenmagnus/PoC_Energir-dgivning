# Driftsdokumentasjon – Energinøkkelen i Google Cloud

Oppdatert: 2025-10-26 (Codex)

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
- **Observability:** Prometheus-metrikker fra building-info-service (eksponert via `/metrics`), Cloud Logging, Cloud Monitoring-uptime check og alert policy for CDN-endepunkt.

---

## 4. Infrastrukturkomponenter

### 4.1 Artifact Registry
- **Repository:** `europe-north1-docker.pkg.dev/energiverktoy-poc-1234/energinokkelen/app`
- Multi-stage Dockerfile bygger image med backend dist og Python-runtime (for scripts).
- Tagging: staging `staging-${SHORT_SHA}`, prod `prod-${SHORT_SHA}` (via Cloud Build-substitusjoner). `latest` brukes for lokal testing.

### 4.2 Cloud Run-tjenester
| Miljø | Tjeneste | Konfigurasjon | Notater |
| --- | --- | --- | --- |
| Staging | `energinokkelen` | 1 CPU / 1 Gi (api + building-info), 0.5 CPU / 512 Mi (solar). `autoscaling.min=0`, `max=4`. Secrets maps via `valueFrom`. | IAM: `roles/run.invoker` midlertidig gitt til `allUsers` for test. Skal fjernes når auth er på plass. |
| Produksjon | `energinokkelen-prod` | Samme image og env, men `_API_ENV=prod`. | Også åpen for `allUsers` i påvente av Cloud Armor/IAP. |

**Miljøvariabler (utvalg):**
- `API_ENV` (`test`/`prod`), `API_PORT=8080`
- `BUILDING_INFO_BASE_URL=http://127.0.0.1:4000`, `SOLAR_SERVICE_BASE_URL=http://127.0.0.1:4003`
- `CONTENT_BUCKET`: staging `energinokkelen-content`, prod `energinokkelen-content-prod`
- Secrets: `MATRIKKEL_*`, `ENOVA_API_KEY`, `LIVE`, `PBE_*`, `VITE_*`

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
- (Planlagt) Flere secrets for frontend runtime ved behov.

Rotasjon skjer manuelt via Secret Manager; Cloud Build har `roles/secretmanager.secretAccessor`.

### 4.4 Service accounts og IAM
- **`cloud-build@energiverktoy-poc-1234.iam.gserviceaccount.com`**  
  Roller: `cloudbuild.builds.editor`, `run.admin`, `artifactregistry.writer`, `secretmanager.secretAccessor`, `iam.serviceAccountUser`, `logging.logWriter`, `storage.objectAdmin`, `compute.loadBalancerAdmin`.
- **`run-energinokkelen@energiverktoy-poc-1234.iam.gserviceaccount.com`**  
  Roller: `run.invoker`, `logging.logWriter`, `monitoring.metricWriter`, `secretmanager.secretAccessor`, `storage.objectViewer` (content/data).
- Serverless NEG service agent (`service-168751968131@serverless-robot-prod.iam.gserviceaccount.com`) har `roles/run.invoker` for prod/staging API via load balancer.
- Manuell bruker (Magnus) kjører gcloud-kommandoer; Ocean avhenger av hans IAM (Project Editor).

### 4.5 Cloud Storage og Cloud CDN
| Bucket | Miljø | Formål | IAM |
| --- | --- | --- | --- |
| `energinokkelen-frontend` | Staging | SPA build (`dist/`) | Cloud Build SA: `storage.objectAdmin`, LB service agent: `storage.objectViewer`, `allUsers` for CDN |
| `energinokkelen-content` | Staging | Runtime content (`content/`) | Cloud Build SA (admin), Cloud Run SA (viewer) |
| `energinokkelen-frontend-prod` | Prod | SPA build prod | Idem, men for prod |
| `energinokkelen-content-prod` | Prod | Runtime content prod | Cloud Run SA (viewer) |
| `energinokkelen-data` | Felles | Rådata/CSV/Excel | Cloud Run SA (viewer) |
| `energinokkelen-build-logs` | Felles | Cloud Build loggbucket | Opprettes automatisk via Cloud Build config |

`deploy/gcp/invalidate-cdn-cache.sh` brukes til å invalidere LB cache etter deploy (via Cloud Build steg).

### 4.6 Load balancer, CDN og DNS
- **Global HTTPS LB:** `staging-frontend-map` (brukes for både staging/prod hostnames).  
  - Backend bucket `staging-frontend-bucket` (staging) og `prod-frontend-bucket` (prod) med host-regler.  
  - Serverless NEG `staging-api-neg` / `prod-api-neg` peker til respektive Cloud Run URLer.  
  - Path rules:  
    - `/api/*`, `/metrics`, `/config/*` → serverless backend  
    - SPA rewrite: forespørsler med `Accept: text/html` → `index.html`
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
  - Midlertidig notification channel: e-post `magnus.lundstein@kli.oslo.kommune.no`. Slack pending org-godkjenning.
- **Logging:** Cloud Run standard logging til Cloud Logging. API/solar/building-info loggfører basishendelser.
- **Dashboards:** Ingen opprettet ennå (TODO: se avsnitt 7).

### 4.9 Automatiserte skript
- `deploy/gcp/invalidate-cdn-cache.sh` – brukes av Cloud Build til å invalidere CDN (`_CDN_PATHS` kan settes).
- `scripts/test-api-smoke.ts` – lokal/staging/prod smoke (brukes i CI og manuelt).
- Andre scripts for data (Python) – foreløpig manuelt trigget.

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
- Oppdater filer i `content/`, kjør staging/prod Cloud Build (evt. med `_DEPLOY=false` hvis backend ikke skal redeployes).  
- Alternativt: `gsutil -m rsync content gs://energinokkelen-content` (staging) eller `...-content-prod` (prod) + `gcloud compute url-maps invalidate-cdn-cache ...`.

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

### 5.7 Backup og datahåndtering
- Rådata i `energinokkelen-data` bør tas jevnlige eksportkopier (gsutil + Cloud Scheduler/lifecycle).  
- Dokumenter eventuelle Excel/CSV-oppdateringer i `Dokumentasjon/` og hold `data/raw/` under versjonskontroll.

### 5.8 Incident response
- Sjekk Cloud Monitoring alert (e-post/Slack).  
- Gå til Cloud Run logs (`gcloud run services logs read energinokkelen --region europe-north1`).  
- For eksterne avhengigheter: se Prometheus-metrikker (`building_info_service_external_*`).  
- Noter hendelsen i dette dokumentet og eventuelt i teamets incidents-tracker.

---

## 6. Sikkerhet og tilgang
- **Per nå:** begge Cloud Run-tjenester er åpne for `allUsers` (`roles/run.invoker`). Dette er midlertidig. Planen er å bruke IAP eller Cloud Armor.  
  - Status: IAP krever at prosjektet ligger under Oslo kommune sin Google Cloud-organisasjon; prosjektet er foreløpig “detached” selv om billing er delt. Må flyttes eller gjenopprettes i org for å aktivere IAP.  
  - Alternativ: Cloud Armor regelsett foran serverless NEG (krever LB policy).
- **Slack varsler:** blokkert av organisatorisk restriksjon på Slack-appen. Midlertidig e-postkanal brukes.  
- **GitHub-integrasjon:** Cloud Build connection `energinokkelen-conn` er satt opp med nødvendige rettigheter.
- **Tilgangsstyring:** bruk IAM-roller `viewer`, `developer`, `release` for teamet. Unngå å dele nøkler uten logging.
- **DNS/domene:** `energinøkkelen.no` er IDN. Kommunens sikkerhetspolicy må whitelist’e punycode-domenet for å unngå blokkering i organisasjonens nett.

---

## 7. Kjent gjøremålsliste
1. **Flytte GCP-prosjektet inn i Oslo kommune-organisasjonen** slik at IAP og Slack-integrasjon kan aktiveres uten blokkering. (Avhengig av GCP/org-admin).  
2. **Aktivere autentisering foran Cloud Run:** enten IAP eller Cloud Armor-regler, deretter fjerne `allUsers`-bindinger (staging + prod).  
3. **Slack-varsler:** få org-godkjenning for Google Cloud Monitoring-appen eller opprette Webhook til `#energinøkkelen-monitor`, oppdatere alert policy.  
4. **Dashboards:** etablere grafana/Cloud Monitoring-dashboard basert på `prometheus-metrikker.md`.  
5. **Playwright/syntetisk test:** automatisere frontend smoke mot CDN.  
6. **Scheduler/tilskudd-jobb:** automatisere oppdatering av `tilskudd.json` (planlagt Cloud Scheduler/Cloud Function).  
7. **Content governance:** dokumentere rutine for akutt innholdsoppdatering + rollback (gsutil versioning).  
8. **Excel-validering:** script for å validere kolonneendringer før synk (nevnt som åpen oppgave).  
9. **Prod CDN invalidasjon:** utvide Cloud Build til også å invalidere `prod-frontend-bucket` ved prod deploy (krever substitusjon og `--service-account` rettigheter).

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
| Dato | Beskrivelse | Utført av |
| --- | --- | --- |
| 2025-10-26 | Første versjon – samlet driftsinformasjon, rutiner og åpne punkter. Erstatter `deploy-plan-gcp.md` som SSOT. | Codex |

---

**Vedlikehold:** Oppdater dokumentet etter hver endring i GCP-infrastruktur, pipelines, sikkerhet eller rutiner. Husk å justere “Oppdatert”-linjen og endringslogg.

